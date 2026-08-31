import "server-only";

/**
 * Erros do caminho de envio.
 *
 * Por que classes próprias em vez de `new Error("…")`: a tela precisa
 * distinguir "não tem número conectado" (mostrar o convite para conectar) de
 * "a janela de 24 horas fechou" (oferecer template) de falha transitória do
 * provedor (oferecer tentar de novo). E a cobrança de ★ precisa saber quando
 * estornar.
 *
 * Cada classe expõe um `code` semântico; os handlers oRPC repassam esse código
 * em `data.code` para o cliente tratar.
 */

export class OutboundProviderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
}

/** O funil não tem número de WhatsApp conectado. */
export class ConnectionNotFoundError extends OutboundProviderError {
  readonly funnelId: string;
  constructor(funnelId: string) {
    super(
      "CONNECTION_NOT_FOUND",
      "Nenhum número de WhatsApp conectado a este funil. Conecte um em Configurações → WhatsApp.",
    );
    this.funnelId = funnelId;
  }
}

/** Conexão existe mas está sem alguma credencial obrigatória. */
export class MetaCredentialsIncompleteError extends OutboundProviderError {
  readonly fields: readonly string[];
  constructor(fields: readonly string[]) {
    super(
      "META_CREDENTIALS_INCOMPLETE",
      `Credenciais da Meta incompletas (${fields.join(", ")}). Reconecte o número em Configurações → WhatsApp.`,
    );
    this.fields = fields;
  }
}

/**
 * O provedor respondeu 200 mas sem o id da mensagem.
 *
 * Acontece em soft-fail e rate-limit da Meta. É falha **transitória** — a tela
 * deve oferecer nova tentativa, não desabilitar nada.
 *
 * O motivo de virar erro em vez de seguir: sem o id, `externalMessageId`
 * receberia string vazia, e como a coluna é única a próxima mensagem nessa
 * situação colidiria. Pior: apagar ou editar por id vazio atingiria a mensagem
 * errada.
 */
export class ProviderSendInvalidResponseError extends OutboundProviderError {
  readonly providerId: string;
  readonly operation: string;
  constructor(providerId: string, operation: string, detail?: string) {
    super(
      "PROVIDER_SEND_INVALID_RESPONSE",
      `O provedor ${providerId} respondeu 200 mas sem id da mensagem em ${operation}. Provável soft-fail ou limite de taxa — a mensagem NÃO foi entregue.${
        detail ? ` ${detail}` : ""
      }`,
    );
    this.providerId = providerId;
    this.operation = operation;
  }
}

/**
 * Recurso que a Cloud API não tem no caminho de saída:
 *
 *  - **editar**: a Meta não expõe endpoint para editar mensagem enviada;
 *  - **apagar**: idem — ela só *recebe* aviso de exclusão pelo webhook;
 *  - **botões**: exigem template aprovado, não existem em envio livre.
 *
 * A tela usa `feature` para explicar o que aconteceu em vez de dar um toast
 * genérico.
 */
export class MetaFeatureUnsupportedError extends OutboundProviderError {
  readonly feature: "edit" | "delete" | "buttons";
  constructor(feature: "edit" | "delete" | "buttons") {
    const textos = {
      edit: "Editar mensagem não existe na API oficial da Meta. A mensagem original continua como está.",
      delete:
        "Apagar mensagem não existe na API oficial da Meta. O destinatário continuará vendo a mensagem.",
      buttons:
        "Botões interativos exigem um template aprovado na Meta. Envie como texto.",
    } as const;
    super("META_FEATURE_UNSUPPORTED", textos[feature]);
    this.feature = feature;
  }
}

/** O provedor ativo não implementa um recurso que outro implementaria. */
export class ProviderFeatureUnsupportedError extends OutboundProviderError {
  readonly providerId: string;
  readonly feature: string;
  constructor(providerId: string, feature: string) {
    super(
      "PROVIDER_FEATURE_UNSUPPORTED",
      `O provedor ativo (${providerId}) não suporta "${feature}".`,
    );
    this.providerId = providerId;
    this.feature = feature;
  }
}

/**
 * A Meta recusou o envio porque a **janela de 24 horas** fechou: passou mais
 * de um dia desde a última mensagem do cliente. Fora da janela só entra
 * template aprovado. Códigos `131047` e `131051`.
 *
 * A tela já bloqueia o campo de texto quando a janela está fechada, mas ela
 * pode fechar entre a leitura e o envio — por isso o erro também existe aqui.
 */
export class OutboundWindowClosedError extends OutboundProviderError {
  constructor(detail?: string) {
    super(
      "META_WINDOW_CLOSED",
      `A janela de 24 horas de atendimento fechou. Envie um template aprovado para reabrir a conversa.${
        detail ? ` ${detail}` : ""
      }`,
    );
  }
}
