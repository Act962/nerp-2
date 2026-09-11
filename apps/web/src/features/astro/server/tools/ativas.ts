/**
 * Quais ferramentas vão para o provedor NESTA mensagem.
 *
 * O conjunto inteiro custa caro: medido nesta instalação, o prompt do sistema
 * tem 12 mil caracteres e os schemas das 42 ferramentas somam 30 mil. São ~42
 * mil caracteres pagos em TODA mensagem, inclusive num "quantos produtos eu
 * tenho" cuja resposta tem quarenta.
 *
 * A economia aqui é conservadora de propósito: **as ferramentas de leitura da
 * operação ficam sempre ligadas**, porque são o valor do Astro e porque uma
 * leitura que falta vira "não consigo ver isso" na cara de quem paga. O que
 * entra e sai são os dois grupos que só servem em conversa específica:
 *
 *  - as do SITE (catálogo da ÓRBITA, estimativa, formulário), que só importam
 *    quando a conversa é sobre contratar mais alguma coisa;
 *  - as de ESCRITA, que só importam quando alguém pede uma ação.
 *
 * Módulo neutro e puro: é uma decisão sobre texto, e o teste a exercita sem
 * banco e sem modelo.
 */

/** As que executam alguma coisa no mundo. Todas param em cartão de aprovação. */
export const FERRAMENTAS_DE_ESCRITA = [
  "criarCatalogoPromocional",
  "criarCampanhaWhatsapp",
  "enviarCampanhaWhatsapp",
  "criarEventoNoCalendario",
  "adicionarImagemAoProduto",
  "gerarImagem",
  "lembrar",
  "esquecer",
  "contatarSuporte",
] as const;

/** As herdadas do consultor do site: catálogo da ÓRBITA, preço, formulário. */
export const FERRAMENTAS_DO_SITE = [
  "buscarFerramentas",
  "detalharFerramenta",
  "detalharSegmento",
  "explicarMetodo",
  "estimarFaixaDePreco",
  "oferecerFormulario",
  "registrarDiagnostico",
  "anotarQuemFala",
  "consultarCnpj",
] as const;

/**
 * Palavras que fazem alguém pedir uma ação.
 *
 * Generosa de propósito. O preço de ligar a escrita sem precisar é alguns
 * milhares de caracteres; o de NÃO ligar quando precisava é o modelo dizer que
 * criou um catálogo que não existe, porque a ferramenta não estava lá para
 * parar no cartão. Um erro custa dinheiro, o outro custa confiança.
 */
const VERBOS_DE_ACAO =
  /\b(cri[ae]r?|crie|monta?r?|monte|gera?r?|gere|fa[çz]a?|fazer|adicion[ae]r?|inclu[ai]r?|dispar[ae]r?|envi[ae]r?|mand[ae]r?|agend[ae]r?|marc[ae]r?|lembr[ae]r?|esque[çc][ae]r?|salv[ae]r?|guard[ae]r?|registr[ae]r?|abr[ai]r?|cham[ae]r?|contat[ae]r?|suporte|ajuda|prepar[ae]r?|public[ae]r?|coloc[ae]r?|põe|poe|bot[ae]r?)\b/;

/** Assuntos que só as ferramentas do site respondem. */
const ASSUNTOS_DO_SITE =
  /\b(orbita|órbita|ferramenta|ferramentas|solu[çc][ãa]o|solu[çc][õo]es|m[óo]dulo|m[óo]dulos|plano|planos|pre[çc]o|pre[çc]os|quanto custa|contratar|assinar|or[çc]amento|mensalidade|m[ée]todo|nasa|cnpj|demonstra[çc][ãa]o|demo)\b/;

export type EscolhaDeFerramentas = {
  /** Os nomes que vão para o provedor nesta chamada. */
  ativas: string[];
  /** Só para o log: por que este conjunto. */
  motivo: { escrita: boolean; site: boolean };
};

export function escolherFerramentas(entrada: {
  /** Tudo o que existe, para nunca ativar um nome que não foi montado. */
  disponiveis: readonly string[];
  /** O que a pessoa escreveu nas últimas falas. */
  texto: string;
  /**
   * O histórico já tem chamada de alguma ferramenta de escrita? Então ela
   * precisa continuar ativa — é como o laço de aprovação termina.
   */
  temEscritaNoHistorico?: boolean;
}): EscolhaDeFerramentas {
  const texto = entrada.texto.toLowerCase();
  const existe = new Set(entrada.disponiveis);

  const querEscrever =
    (entrada.temEscritaNoHistorico ?? false) || VERBOS_DE_ACAO.test(texto);
  const querSite = ASSUNTOS_DO_SITE.test(texto);

  const fora = new Set<string>();
  if (!querEscrever) {
    for (const nome of FERRAMENTAS_DE_ESCRITA) fora.add(nome);
  }
  if (!querSite) {
    for (const nome of FERRAMENTAS_DO_SITE) fora.add(nome);
  }

  return {
    ativas: entrada.disponiveis.filter(
      (nome) => existe.has(nome) && !fora.has(nome),
    ),
    motivo: { escrita: querEscrever, site: querSite },
  };
}

/** O histórico menciona alguma ferramenta de escrita? */
export function historicoTemEscrita(mensagens: readonly unknown[]): boolean {
  const escrita = new Set<string>(FERRAMENTAS_DE_ESCRITA);
  for (const mensagem of mensagens) {
    // O histórico vem do navegador: `null` e string solta cabem aqui, e
    // estourar na leitura derrubaria a conversa inteira.
    if (typeof mensagem !== "object" || mensagem === null) continue;
    const partes = (mensagem as { parts?: unknown }).parts;
    if (!Array.isArray(partes)) continue;
    for (const parte of partes) {
      if (typeof parte !== "object" || parte === null) continue;
      const tipo = (parte as { type?: unknown }).type;
      if (typeof tipo !== "string" || !tipo.startsWith("tool-")) continue;
      if (escrita.has(tipo.slice("tool-".length))) return true;
    }
  }
  return false;
}
