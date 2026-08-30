import type { IntegrationCategory } from "@/generated/prisma/enums";

/** O que o conector sabe fazer. Vira badge no card e filtro no conciliador. */
export type Capacidade =
  | "extrato"
  | "saldo"
  | "recebiveis"
  | "taxas"
  | "cobranca";

export type FormatoArquivo = "OFX" | "CNAB240" | "CNAB400" | "EDI" | "CSV";

export type Ambiente = "sandbox" | "producao";

/**
 * Um campo do formulário de instalação.
 *
 * `tipo` também decide o sigilo: `password` e `file` NUNCA voltam para o
 * client; `text` volta para preencher o formulário na edição. Não existe uma
 * flag `secret` separada de propósito — duas fontes de verdade sobre o que é
 * segredo é como segredo vaza.
 */
export type CredentialField = {
  key: string;
  label: string;
  tipo: "text" | "password" | "file";
  /** Onde o lojista acha esse valor no portal do provedor. */
  ajuda?: string;
  placeholder?: string;
  /** Extensões aceitas quando `tipo: "file"`. */
  aceita?: string[];
  opcional?: boolean;
};

export type ProviderAuth = {
  tipo:
    | "OAUTH2_CLIENT_CREDENTIALS"
    | "OAUTH2_AUTHORIZATION_CODE"
    | "API_KEY"
    | "ARQUIVO";
  /**
   * Exige certificado + chave privada. Toda rota que falar com um provedor
   * `mtls` roda no runtime Node — Edge não faz TLS mútuo.
   */
  mtls?: boolean;
  campos: CredentialField[];
  scopes?: string[];
  formatos?: FormatoArquivo[];
};

export type ProviderManifest = {
  /** Casa com `FinancialIntegration.providerId`. Não mudar depois de publicado. */
  id: string;
  nome: string;
  categoria: IntegrationCategory;
  /** `/integracoes/<id>.svg`; `null` cai no monograma (ver `provider-logo`). */
  logo: string | null;
  /** Cor da marca — monograma e barra do card. */
  cor: string;
  resumo: string;
  auth: ProviderAuth;
  capacidades: Capacidade[];
  ambientes: Ambiente[];
  /**
   * Existe conector? `false` vira card "Em breve": aparece no catálogo, conta
   * a história do roadmap e não abre formulário. Ligar um provedor pronto é
   * trocar esta flag.
   */
  disponivel: boolean;
  /**
   * Mostrado ANTES do formulário quando a credencial não é autosserviço.
   * Descobrir que precisa falar com o gerente depois de preencher tudo é o
   * pior desfecho possível.
   */
  preRequisito?: string;
  /**
   * Integrações que já existiam antes do catálogo têm painel próprio no lugar
   * do formulário genérico.
   */
  painelProprio?: "winthor" | "fiscal" | "google-drive";
  docsUrl?: string;
};
