/**
 * O que o Astro NÃO faz sem alguém dizer sim.
 *
 * Toda tool listada aqui para o laço no `streamText` e devolve um pedido de
 * aprovação ao cliente; a execução só acontece depois que a pessoa aprova no
 * cartão da conversa. O `experimental_toolApprovalSecret` assina o pedido:
 * sem a assinatura, um cliente que reenvia o próprio histórico com
 * `approved: true` não engana o servidor.
 *
 * Módulo neutro (sem `server-only`) porque a lista de rótulos também é do
 * cliente, que desenha o cartão — e duas listas divergiriam.
 */

export const ACOES_QUE_PEDEM_APROVACAO = [
  "criarCatalogoPromocional",
  "criarCampanhaWhatsapp",
  "enviarCampanhaWhatsapp",
  "criarEventoNoCalendario",
  "adicionarImagemAoProduto",
  "gerarImagem",
  "lembrar",
  "esquecer",
] as const;

export type AcaoQuePedeAprovacao = (typeof ACOES_QUE_PEDEM_APROVACAO)[number];

/** Rótulo e resumo de cada ação, para o cartão de aprovação. */
export const ROTULO_DA_ACAO: Record<
  AcaoQuePedeAprovacao,
  { titulo: string; resumir: (entrada: Record<string, unknown>) => string }
> = {
  criarCatalogoPromocional: {
    titulo: "Criar um catálogo promocional",
    resumir: (entrada) =>
      `"${texto(entrada.nome) || "Sem nome"}" com os produtos em promoção${
        Array.isArray(entrada.categorias) && entrada.categorias.length > 0
          ? ` de ${entrada.categorias.join(", ")}`
          : ""
      }.`,
  },
  criarCampanhaWhatsapp: {
    titulo: "Montar uma campanha de WhatsApp",
    resumir: (entrada) =>
      `"${texto(entrada.nome) || "Sem nome"}" — a audiência é montada agora, mas nada é enviado sem você escolher o template e aprovar o disparo.`,
  },
  enviarCampanhaWhatsapp: {
    titulo: "DISPARAR a campanha para os destinatários",
    resumir: (entrada) =>
      `Template "${texto(entrada.template) || "?"}". As mensagens saem de verdade e cada destinatário custa ★.`,
  },
  criarEventoNoCalendario: {
    titulo: "Criar uma ação no calendário",
    resumir: (entrada) =>
      `"${texto(entrada.titulo) || "Sem título"}" em ${texto(entrada.inicio) || "data não informada"}.`,
  },
  adicionarImagemAoProduto: {
    titulo: "Adicionar uma imagem ao produto",
    resumir: (entrada) =>
      `Produto "${texto(entrada.produto) || "?"}", imagem de ${texto(entrada.url) || "endereço não informado"}.`,
  },
  lembrar: {
    titulo: "Guardar isso na memória",
    resumir: (entrada) =>
      `"${texto(entrada.fato) || "Sem fato"}" — fica guardado para as próximas conversas, em ${texto(entrada.chave) || "sem chave"}.`,
  },
  esquecer: {
    titulo: "Esquecer o que foi guardado",
    resumir: (entrada) =>
      `Apagar o que está em "${texto(entrada.chave) || "sem chave"}". Não dá para desfazer.`,
  },
  gerarImagem: {
    titulo: "Gerar uma imagem",
    resumir: (entrada) =>
      `"${texto(entrada.descricao) || "Sem descrição"}" — a imagem é criada pelo provedor e guardada no seu acervo, e isso custa ★.`,
  },
};

/** A configuração que vai para o `streamText`. */
export const CONFIGURACAO_DE_APROVACAO = Object.fromEntries(
  ACOES_QUE_PEDEM_APROVACAO.map((nome) => [nome, "user-approval" as const]),
);

/**
 * O segredo que assina o pedido de aprovação. Cai no segredo do Better Auth
 * quando não há um próprio: os dois já são segredos do servidor, e ficar sem
 * assinatura nenhuma seria pior.
 */
export function segredoDeAprovacao(): string | undefined {
  return (
    process.env.ASTRO_TOOL_APPROVAL_SECRET ?? process.env.BETTER_AUTH_SECRET
  );
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}
