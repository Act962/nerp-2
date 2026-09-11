"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type FileUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AstroMark } from "./astro-mark";
import { useVoz } from "./use-voz";
import type { PaginaDoAstro } from "./pagina";
import "./astro-widget.css";

/**
 * O consultor — o mesmo widget no site e dentro do nerp.
 *
 * O que muda entre os dois vem por props: para onde o POST vai, se está
 * ligado, o que o painel sugere no vazio, de onde vem o produto da página, e o
 * que fazer quando o servidor recusa (no nerp, um 402 é "acabaram as ★" e vira
 * o botão de compra — que só o app sabe desenhar).
 *
 * O botão fica no lugar onde o do WhatsApp ficava — e o WhatsApp não some do
 * site: virou a saída "falar com uma pessoa" dentro do painel, o CTA da barra e
 * o que aparece quando o Astro está sem resposta. Sem isso, trocar o ícone
 * tiraria o único canal de contato que o site tem.
 *
 * O painel é o leiaute aprovado: cabeçalho, uma pergunta grande enquanto não
 * há conversa, três sugestões que JÁ SÃO o primeiro turno, e o campo numa
 * pílula. Sem anexo e sem microfone: não há upload nem voz nesta entrega, e
 * botão que não faz nada é pior que botão que não existe.
 *
 * O POST vai para `/api/astro/chat` do próprio site, que repassa ao `apps/web`.
 * Mesma origem: sem CORS, sem preflight, e o segredo fica no servidor.
 */

type Sugestao = { texto: string; envio: string; icone: ReactNode };

const ICONE_BUSCA = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
    <title>Diagnóstico</title>
    <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="m20 20-4-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const ICONE_METODO = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
    <title>Método</title>
    <path
      d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

const ICONE_PRECO = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
    <title>Investimento</title>
    <path
      d="M12 4v16M8.5 7.5h6M8.5 12h7M9 16.5h6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const ICONE_SEGMENTO = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
    <title>Segmentos</title>
    <path
      d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Uma solução citada na conversa, do jeito que ela vira cartão.
 *
 * Os campos saem prontos das tools do consultor — o `href` inclusive. Nada
 * aqui é montado a partir do texto do modelo: caminho de página escrito por
 * LLM é link quebrado esperando acontecer.
 */
type SolucaoCitada = {
  id: string;
  nome: string;
  tagline: string;
  href: string;
};

function textoDe(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/** Lê uma ferramenta de um objeto solto vindo da tool. */
function paraSolucao(bruto: unknown): SolucaoCitada | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const item = bruto as Record<string, unknown>;
  const id = textoDe(item.id);
  const href = textoDe(item.href);
  // Sem página publicada não há para onde mandar ninguém.
  if (!id || !href) return null;
  return {
    id,
    nome: textoDe(item.nome) || id,
    tagline: textoDe(item.tagline),
    href,
  };
}

/**
 * As soluções que apareceram numa resposta do Astro.
 *
 * Três tools desembocam aqui: `buscarFerramentas` e `detalharSegmento` trazem
 * uma lista em `ferramentas`, e `detalharFerramenta` traz uma só, no próprio
 * objeto. O painel não precisa saber qual delas rodou — só que existe algo
 * para onde ir.
 */
function solucoesDaMensagem(mensagem: {
  parts: Array<{ type: string }>;
}): SolucaoCitada[] {
  const achadas = new Map<string, SolucaoCitada>();

  for (const parte of mensagem.parts) {
    if (!parte.type.startsWith("tool-")) continue;
    const comSaida = parte as { state?: string; output?: unknown };
    if (comSaida.state !== "output-available") continue;

    const saida = comSaida.output;
    if (typeof saida !== "object" || saida === null) continue;

    const lista = (saida as { ferramentas?: unknown }).ferramentas;
    const candidatos = Array.isArray(lista) ? lista : [saida];

    for (const candidato of candidatos) {
      const solucao = paraSolucao(candidato);
      // O `Map` cuida da repetição: a mesma ferramenta costuma aparecer na
      // busca e no detalhe, e o visitante não precisa do link duas vezes.
      if (solucao && !achadas.has(solucao.id)) achadas.set(solucao.id, solucao);
    }
  }

  return [...achadas.values()];
}

/**
 * O convite para o formulário, quando ele aparece numa resposta.
 *
 * Vem da tool, nunca do texto do modelo — a mesma regra dos cartões de link, e
 * aqui ela pesa mais: o endereço é longo e cheio de parâmetro de campanha, e
 * um caractere trocado no meio manda um lead interessado para lugar nenhum.
 */
type ConviteDeFormulario = { url: string; rotulo: string; motivo: string };

/** Quem está do outro lado, na medida em que ele foi descobrindo. */
type Visitante = { nome?: string; empresa?: string; cnpj?: string };

/**
 * Uma ação que o Astro quer executar e está esperando o sim.
 *
 * Vem das partes `tool-*` no estado `approval-requested`, que o AI SDK cria
 * quando a tool está em `toolApproval`. O `id` é o que volta assinado ao
 * servidor: sem ele, nada executa.
 */
export type PedidoDeAprovacao = {
  id: string;
  ferramenta: string;
  entrada: Record<string, unknown>;
  /** Já respondido, esperando o servidor. */
  respondido: boolean;
  /** Respondido com "não". */
  recusado: boolean;
};

function pedidosDeAprovacao(mensagem: {
  parts: Array<{ type: string }>;
}): PedidoDeAprovacao[] {
  const pedidos: PedidoDeAprovacao[] = [];
  for (const parte of mensagem.parts) {
    if (!parte.type.startsWith("tool-")) continue;
    const comAprovacao = parte as {
      state?: string;
      input?: unknown;
      approval?: { id?: string; approved?: boolean };
    };
    const estado = comAprovacao.state;
    if (
      estado !== "approval-requested" &&
      estado !== "approval-responded" &&
      estado !== "output-denied"
    ) {
      continue;
    }
    const id = comAprovacao.approval?.id;
    if (!id) continue;
    pedidos.push({
      id,
      ferramenta: parte.type.replace(/^tool-/, ""),
      entrada:
        typeof comAprovacao.input === "object" && comAprovacao.input !== null
          ? (comAprovacao.input as Record<string, unknown>)
          : {},
      respondido: estado !== "approval-requested",
      recusado:
        estado === "output-denied" || comAprovacao.approval?.approved === false,
    });
  }
  return pedidos;
}

/** Um botão que a tool devolveu — o modelo nunca escreve o endereço. */
type LinkDeAcao = { rotulo: string; href: string };

function linksDaMensagem(mensagem: {
  parts: Array<{ type: string }>;
}): LinkDeAcao[] {
  const links: LinkDeAcao[] = [];
  for (const saida of saidasDeTool(mensagem)) {
    const link = (saida as { link?: unknown }).link;
    if (typeof link !== "object" || link === null) continue;
    const campos = link as Record<string, unknown>;
    const href = textoDe(campos.href);
    if (!href.startsWith("/")) continue;
    links.push({ href, rotulo: textoDe(campos.rotulo) || "Abrir" });
  }
  return links;
}

/** Uma imagem que a tool devolveu — gerada pelo Astro, não escrita por ele. */
type ImagemDaResposta = { url: string; descricao: string };

function imagensDaMensagem(mensagem: {
  parts: Array<{ type: string }>;
}): ImagemDaResposta[] {
  const imagens: ImagemDaResposta[] = [];
  for (const saida of saidasDeTool(mensagem)) {
    const imagem = (saida as { imagem?: unknown }).imagem;
    if (typeof imagem !== "object" || imagem === null) continue;
    const campos = imagem as Record<string, unknown>;
    const url = textoDe(campos.url);
    if (!url.startsWith("https://")) continue;
    imagens.push({ url, descricao: textoDe(campos.descricao) });
  }
  return imagens;
}

/** As imagens que a PESSOA anexou (ou que já viajaram na conversa). */
function anexosDaMensagem(mensagem: {
  parts: Array<{ type: string }>;
}): FileUIPart[] {
  const anexos: FileUIPart[] = [];
  for (const parte of mensagem.parts) {
    if (parte.type !== "file") continue;
    const arquivo = parte as unknown as FileUIPart;
    if (!arquivo.mediaType?.startsWith("image")) continue;
    anexos.push(arquivo);
  }
  return anexos;
}

/** As saídas de tool de uma mensagem, já filtradas pelas que deram certo. */
function saidasDeTool(mensagem: { parts: Array<{ type: string }> }): unknown[] {
  const saidas: unknown[] = [];
  for (const parte of mensagem.parts) {
    if (!parte.type.startsWith("tool-")) continue;
    const comSaida = parte as { state?: string; output?: unknown };
    if (comSaida.state !== "output-available") continue;
    if (typeof comSaida.output === "object" && comSaida.output !== null) {
      saidas.push(comSaida.output);
    }
  }
  return saidas;
}

function formularioDaMensagem(mensagem: {
  parts: Array<{ type: string }>;
}): ConviteDeFormulario | null {
  for (const saida of saidasDeTool(mensagem)) {
    const convite = (saida as { formulario?: unknown }).formulario;
    if (typeof convite !== "object" || convite === null) continue;
    const campos = convite as Record<string, unknown>;
    const url = textoDe(campos.url);
    // Endereço que não é endereço não vira botão.
    if (!url.startsWith("https://")) continue;
    return {
      url,
      rotulo: textoDe(campos.rotulo) || "Preencher formulário",
      motivo: textoDe(campos.motivo),
    };
  }
  return null;
}

function identidadeDaMensagem(mensagem: {
  parts: Array<{ type: string }>;
}): Visitante | null {
  for (const saida of saidasDeTool(mensagem)) {
    const anotado = (saida as { visitante?: unknown }).visitante;
    if (typeof anotado !== "object" || anotado === null) continue;
    const campos = anotado as Record<string, unknown>;
    const quem: Visitante = {};
    if (textoDe(campos.nome)) quem.nome = textoDe(campos.nome);
    if (textoDe(campos.empresa)) quem.empresa = textoDe(campos.empresa);
    if (textoDe(campos.cnpj)) quem.cnpj = textoDe(campos.cnpj);
    if (Object.keys(quem).length > 0) return quem;
  }
  return null;
}

/**
 * O nome fica no navegador, não no banco.
 *
 * Mesma escolha da trilha, pelo mesmo motivo: guardar no servidor o nome de
 * quem só conversou e foi embora é cadastrar visitante que nunca pediu para
 * ser cadastrado. Ele sobe junto de cada mensagem e serve a uma coisa só — o
 * Astro não perguntar duas vezes o que já lhe disseram. Quem vira lead de
 * verdade é gravado pelo fecho, com o consentimento que veio junto.
 */
const QUEM = "orbita:astro:quem";

function lerVisitante(): Visitante {
  try {
    const cru = sessionStorage.getItem(QUEM);
    return cru ? (JSON.parse(cru) as Visitante) : {};
  } catch {
    return {};
  }
}

function guardarVisitante(quem: Visitante) {
  try {
    sessionStorage.setItem(QUEM, JSON.stringify(quem));
  } catch {
    // Sem memória ele pergunta o nome de novo numa página nova. Chato, não
    // quebrado — e é por isso que a pergunta é "uma vez", não "nunca mais".
  }
}

/**
 * Onde a conversa fica entre uma página e outra.
 *
 * `sessionStorage` e não `localStorage`: a conversa é da visita, não da
 * pessoa. Fechou a aba, acabou — e ninguém volta uma semana depois para
 * encontrar um diagnóstico pela metade esperando resposta.
 */
const GUARDA = "orbita:astro";

type ConversaGuardada = {
  sessionId: string | null;
  aberto: boolean;
  messages: UIMessage[];
};

function lerConversa(): ConversaGuardada | null {
  try {
    const cru = sessionStorage.getItem(GUARDA);
    if (!cru) return null;
    const dados = JSON.parse(cru) as ConversaGuardada;
    return Array.isArray(dados.messages) ? dados : null;
  } catch {
    // Aba anônima, cota estourada, JSON estragado: sem conversa guardada o
    // Astro começa do zero, que é ruim mas não é quebrado.
    return null;
  }
}

function esquecerConversa() {
  try {
    sessionStorage.removeItem(GUARDA);
  } catch {
    // Idem: não conseguir limpar não pode impedir a conversa nova de começar.
  }
}

function guardarConversa(dados: ConversaGuardada) {
  try {
    sessionStorage.setItem(GUARDA, JSON.stringify(dados));
  } catch {
    // Idem: não guardar é aceitável, derrubar o widget não é.
  }
}

/**
 * A trilha do visitante: por onde ele passou nesta visita.
 *
 * Fica no NAVEGADOR, e sobe para o servidor só quando a conversa começa. É
 * uma escolha deliberada: guardar no banco a navegação de quem nunca falou
 * com a gente é perfilar visitante anônimo, e o valor — o Astro saber que a
 * pessoa veio do Tracking — se tem igual mandando a trilha junto da primeira
 * mensagem, quando ela já aceitou o aviso.
 */
const TRILHA = "orbita:astro:trilha";

/** Quantas páginas o Astro lembra. Mais que isso não muda a conversa. */
const TRILHA_MAX = 12;

type Passo = { slug: string; titulo: string };

function lerTrilha(): Passo[] {
  try {
    const cru = sessionStorage.getItem(TRILHA);
    const dados = cru ? (JSON.parse(cru) as Passo[]) : [];
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function anotarNaTrilha(passo: Passo): Passo[] {
  try {
    const trilha = lerTrilha();
    // Recarregar a mesma página não vira passo novo.
    if (trilha.at(-1)?.slug === passo.slug) return trilha;
    const proxima = [...trilha, passo].slice(-TRILHA_MAX);
    sessionStorage.setItem(TRILHA, JSON.stringify(proxima));
    return proxima;
  } catch {
    return [];
  }
}

/** Quais páginas já ouviram os balões, para ele não repetir a graça. */
const JA_FALOU = "orbita:astro:falou";

function jaFalouAqui(slug: string): boolean {
  try {
    return (sessionStorage.getItem(JA_FALOU) ?? "").split(",").includes(slug);
  } catch {
    return false;
  }
}

function marcarQueFalou(slug: string) {
  try {
    const atual = (sessionStorage.getItem(JA_FALOU) ?? "")
      .split(",")
      .filter(Boolean);
    sessionStorage.setItem(JA_FALOU, [...atual, slug].join(","));
  } catch {
    // Sem memória ele repete a fala numa revisita. Chato, não quebrado.
  }
}

/**
 * Se o convite do fim da viagem já foi feito nesta visita.
 *
 * Uma vez por visita e ponto: painel que abre sozinho toda vez que alguém
 * chega ao fim de uma página é pop-up, não convite.
 */
const RODAPE = "orbita:astro:rodape";

function jaConvidouNoRodape(): boolean {
  try {
    return sessionStorage.getItem(RODAPE) === "1";
  } catch {
    return false;
  }
}

function marcarConviteNoRodape() {
  try {
    sessionStorage.setItem(RODAPE, "1");
  } catch {
    // Sem memória ele convida de novo na próxima página. Chato, não quebrado.
  }
}

/** Quão perto do fim já conta como "chegou ao rodapé". */
const MARGEM_DO_FIM = 120;

/**
 * O quanto a página precisa ser maior que a tela para ter havido viagem.
 *
 * Numa página curta o fim é o próprio começo, e sem esta trava o painel
 * abriria sozinho no carregamento — que é o oposto de recompensar quem rolou
 * o site inteiro.
 */
const VIAGEM_MINIMA = 1.5;

/** De quanto em quanto tempo ele confere se a viagem acabou. */
const INTERVALO_DE_ESPREITA = 300;

/**
 * Quantas leituras seguidas no fim valem como "chegou".
 *
 * Uma só não vale: a home é pinada pelo ScrollTrigger, e num salto brusco de
 * rolagem a altura da página oscila por um quadro — medido, o painel abriu na
 * METADE da viagem porque naquele instante o fim da página tinha encolhido
 * até debaixo dos pés de quem rolava.
 *
 * Quase um segundo parado no rodapé também é melhor como gesto: quem bate no
 * fim e volta correndo não estava procurando conversa.
 */
const CONFIRMACOES_DO_FIM = 3;

/**
 * O que ele diz onde não há página cadastrada — a home, principalmente.
 *
 * A home não é uma `SitePage`, então não passa pelo admin e não tem balão
 * próprio. Em vez de ficar mudo justamente onde quase todo mundo entra, ele
 * puxa assunto com uma dessas, sorteadas a cada visita: genéricas de
 * propósito, porque ali ele ainda não sabe do que a pessoa veio atrás.
 */
const FALAS_SOLTAS = [
  "Qualquer coisa, tô aqui!",
  "Ei, tô aqui 👋",
  "Top hein?!",
  "Tá gostando?",
  "Se perder, me chama",
  "Bora achar o que serve pra você?",
];

/** Duas das soltas, sorteadas e sem repetir. */
function sortearFalas(quantas = 2): string[] {
  const baralho = [...FALAS_SOLTAS];
  const escolhidas: string[] = [];
  while (escolhidas.length < quantas && baralho.length > 0) {
    const [fala] = baralho.splice(
      Math.floor(Math.random() * baralho.length),
      1,
    );
    escolhidas.push(fala);
  }
  return escolhidas;
}

/** Espera antes do primeiro balão: tempo de a página assentar e ser lida. */
const ATRASO_PRIMEIRO_BALAO = 2200;

/** Intervalo entre um balão e o seguinte. */
const INTERVALO_ENTRE_BALOES = 3400;

/** Quanto o último balão fica na tela antes de sumir sozinho. */
const BALAO_NA_TELA = 7000;

/**
 * Quanto o Astro espera por uma resposta antes de emburrar.
 *
 * Seis segundos: tempo de ler duas ou três frases e começar a digitar. Menos
 * que isso cutucaria quem ainda está lendo.
 */
const ESPERA_POR_RESPOSTA = 6000;

/**
 * A queixa de quem foi deixado no vácuo.
 *
 * Fechar o painel com a última palavra sendo dele é o vácuo mais literal que
 * existe aqui, e esta é a única fala que ele solta sem ter sido chamado. Por
 * isso é queixa de brincadeira: cobrança de verdade, num mascote, vira
 * chateação.
 */
const FALA_SOZINHO = "Me deixou falando sozinho!";

/** O que dizer quando o servidor recusou e ninguém tratou a falha. */
function mensagemDaFalha(falha: FalhaDoAstro): string {
  const corpo =
    typeof falha.corpo === "object" && falha.corpo !== null
      ? (falha.corpo as { mensagem?: unknown; erro?: unknown })
      : {};
  if (typeof corpo.mensagem === "string") return corpo.mensagem;
  if (falha.status === 429)
    return "Muitas mensagens por agora. Tenta de novo daqui a pouco.";
  if (falha.status === 400)
    return "Esta conversa ficou grande demais para eu carregar. Comece uma nova aqui em cima — o que a gente tratou fica com você.";
  if (falha.status === 503)
    return "Estou fora do ar por um instante. Já volto.";
  return "Não consegui responder agora. Tenta de novo?";
}

/** A saudação muda com a hora, como na referência. */
function perguntaDaHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "O que está travando sua operação esta manhã?";
  if (hora < 18) return "O que está travando sua operação hoje?";
  return "O que está travando sua operação esta noite?";
}

/** De que produto a página fala, quando fala de um. */
export type ProdutoDaPagina = {
  nome: string;
  /** Títulos das funcionalidades, para sortear uma sugestão. */
  funcionalidades: string[];
};

/** Uma resposta que não veio: o servidor recusou antes de abrir o stream. */
export type FalhaDoAstro = { status: number; corpo: unknown };

export type AstroWidgetProps = {
  /** Para onde vai o POST da conversa. */
  api: string;
  /** Desligado, o botão não aparece. */
  ativo?: boolean;
  /** A página onde a pessoa está, quando é uma página cadastrada. */
  pagina?: PaginaDoAstro;
  /** O produto desta página, quando ela é de um. */
  produto?: ProdutoDaPagina | null;
  /** Há tabela de preço: a terceira sugestão vira "estimar quanto ficaria". */
  precos?: boolean;
  /** A saída "falar com uma pessoa". Sem ela, o link não aparece. */
  whatsappHref?: string;
  /** Prefixo dos links de solução (no nerp, o endereço do site). */
  baseDosLinks?: string;
  /** Abre link de solução em aba nova (no nerp, para não sair do sistema). */
  linksEmNovaAba?: boolean;
  /** A pergunta do estado vazio, quando não há produto de página. */
  abertura?: string;
  /** As sugestões do estado vazio, quando não há produto de página. */
  sugestoes?: { texto: string; envio: string }[];
  /** A nota do rodapé. */
  nota?: ReactNode;
  /** Consentimento já dado (no nerp, quem fala está logado). */
  consentimento?: boolean;
  /** O que desenhar quando o servidor recusa. `null` deixa o aviso padrão. */
  aoFalhar?: (falha: FalhaDoAstro) => ReactNode;
  /** Chamado quando uma resposta termina de chegar. */
  onResposta?: () => void;
  /**
   * Rótulo e resumo de cada ação que pede aprovação. O pacote não conhece o
   * domínio: quem monta o widget é que sabe o que "criarCatalogoPromocional"
   * significa para quem está lendo.
   */
  acoes?: Record<
    string,
    { titulo: string; resumir: (entrada: Record<string, unknown>) => string }
  >;
  /**
   * Sobe um arquivo e devolve a parte pronta para a mensagem. Sem esta prop
   * não há botão de anexo: o pacote não sabe para onde subir arquivo, e é o
   * app que tem bucket, sessão e organização.
   */
  enviarArquivo?: (arquivo: File) => Promise<FileUIPart | null>;
  /** Tipos aceitos. A mesma lista que o servidor confere. */
  tiposDeArquivo?: readonly string[];
  /** Quantos anexos cabem numa mensagem. */
  maxArquivos?: number;
  /**
   * Os avisos abertos da organização. Viram selo no botão, uma fala no balão
   * e cartões no topo do painel. Sem a prop, nada disso existe — é o que
   * mantém o widget do site igual ao que era.
   */
  avisos?: readonly AvisoDoAstro[];
  /** O mascote acabou de falar este aviso. */
  aoFalarAviso?: (id: string) => void;
  /** A pessoa leu (ou pediu para explicar) este aviso. */
  aoLerAviso?: (id: string) => void;
};

/**
 * Um aviso que o Astro tem para dar. O pacote não sabe o que cada tipo
 * significa — recebe pronto e só ordena pela severidade.
 */
export type AvisoDoAstro = {
  id: string;
  severidade: "alta" | "media" | "baixa";
  titulo: string;
  corpo: string;
  lido: boolean;
  falado: boolean;
};

const PESO: Record<AvisoDoAstro["severidade"], number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

/** O aviso que ele fala: o mais grave entre os que ainda não foram falados. */
function avisoParaFalar(avisos: readonly AvisoDoAstro[]): AvisoDoAstro | null {
  const candidatos = avisos.filter((aviso) => !aviso.falado && !aviso.lido);
  if (candidatos.length === 0) return null;
  return [...candidatos].sort(
    (a, b) => PESO[b.severidade] - PESO[a.severidade],
  )[0];
}

/** O que o servidor aceita — repetido aqui para o seletor já filtrar. */
const TIPOS_DE_IMAGEM = ["image/jpeg", "image/png", "image/webp"] as const;

/** Evento que abre o painel de fora (um botão de "Falar com o Astro"). */
export const ABRIR_ASTRO = "astro:abrir";

export function abrirAstro() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ABRIR_ASTRO));
}

export function AstroWidget({
  api,
  ativo = true,
  pagina,
  produto = null,
  precos = false,
  whatsappHref,
  baseDosLinks = "",
  linksEmNovaAba = false,
  abertura: aberturaPadrao,
  sugestoes: sugestoesPadrao,
  nota,
  consentimento = true,
  aoFalhar,
  onResposta,
  acoes,
  enviarArquivo,
  tiposDeArquivo = TIPOS_DE_IMAGEM,
  maxArquivos = 4,
  avisos: avisosDoAstro,
  aoFalarAviso,
  aoLerAviso,
}: AstroWidgetProps) {
  const [aberto, setAberto] = useState(false);
  const [falha, setFalha] = useState<FalhaDoAstro | null>(null);
  const [texto, setTexto] = useState("");
  const [pergunta, setPergunta] = useState("O que está travando sua operação?");
  const [semResposta, setSemResposta] = useState(false);
  const [balao, setBalao] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<FileUIPart[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [erroDoAnexo, setErroDoAnexo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const seletorRef = useRef<HTMLInputElement>(null);
  const trilhaRef = useRef<Passo[]>([]);
  const visitanteRef = useRef<Visitante>({});
  /*
    O transporte é montado uma vez só (`useMemo` sem dependências) e ficaria
    preso na página em que o widget nasceu. A referência é o que mantém o
    contexto atual sem remontar a conversa a cada navegação.
  */
  const paginaRef = useRef<
    | { slug: string; titulo: string; palavrasChave: string[]; resumo: string }
    | undefined
  >(undefined);
  useEffect(() => {
    paginaRef.current = pagina
      ? {
          slug: pagina.slug,
          titulo: pagina.titulo,
          palavrasChave: pagina.config.palavrasChave,
          resumo: pagina.config.resumo,
        }
      : undefined;
  }, [pagina]);
  const corpoRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const sessaoRef = useRef<string | null>(null);

  // A hora só é conhecida no cliente: montar isto no servidor daria hidratação
  // divergente sempre que a build e a visita caíssem em períodos diferentes.
  useEffect(() => setPergunta(perguntaDaHora()), []);

  /*
    De que produto esta página fala.

    Nem toda página é de solução: segmentos e o método não têm ferramenta, e
    aí a abertura do painel volta a ser a geral.
  */
  const ferramentaDaPagina = produto;

  /*
    Uma funcionalidade da ferramenta, sorteada uma vez por montagem.

    Sorteada, e não a primeira, porque quem volta à página encontra um convite
    diferente — e porque a primeira do catálogo não é necessariamente a mais
    interessante de perguntar.
  */
  const funcionalidadeEmDestaque = useMemo(() => {
    const lista = ferramentaDaPagina?.funcionalidades ?? [];
    if (lista.length === 0) return "";
    return lista[Math.floor(Math.random() * lista.length)].toLowerCase();
  }, [ferramentaDaPagina]);

  /** Onde ele fala, para não repetir a mesma graça na mesma página. */
  const ondeEstou = pagina?.slug ?? "home";

  /**
   * O Astro puxa assunto quando alguém chega.
   *
   * Os balões são escritos no admin, página por página — nunca gerados. Eles
   * aparecem em toda visita, e pagar um modelo para inventar "essa é top hein"
   * a cada carregamento seria caro e pior.
   *
   * Fala uma vez por página por visita: repetir a mesma graça a cada volta é o
   * que transforma um mascote simpático num pop-up.
   */
  useEffect(() => {
    if (pagina) {
      trilhaRef.current = anotarNaTrilha({
        slug: pagina.slug,
        titulo: pagina.titulo,
      });
    }

    /*
      Onde há página cadastrada, valem os balões dela — e se o admin deixou a
      lista vazia com o Astro ligado, é porque não há o que dizer ali; ele
      respeita o silêncio.

      Sem página nenhuma (a home) ele usa as falas soltas, sorteadas. É o único
      lugar onde a fala não passa pelo admin, porque a home não é uma página
      cadastrável.
    */
    const falas = pagina
      ? pagina.config.baloes.map((fala) => fala.trim()).filter(Boolean)
      : sortearFalas();
    const podeFalar = pagina ? pagina.config.ativo : true;

    if (
      !ativo ||
      // Painel aberto: a conversa já está acontecendo, o balão não tem função.
      aberto ||
      !podeFalar ||
      falas.length === 0 ||
      jaFalouAqui(ondeEstou)
    ) {
      return;
    }

    const relogios: ReturnType<typeof setTimeout>[] = [];
    falas.forEach((fala, indice) => {
      relogios.push(
        setTimeout(
          () => {
            setBalao(fala);
            // A página só é dada como falada quando a PRIMEIRA fala aparece de
            // verdade. Marcar no agendamento queimava a página de quem passou
            // rápido por ela: o balão nunca chegou a existir, e mesmo assim
            // ele nunca mais falava ali.
            if (indice === 0) marcarQueFalou(ondeEstou);
          },
          ATRASO_PRIMEIRO_BALAO + indice * INTERVALO_ENTRE_BALOES,
        ),
      );
    });
    relogios.push(
      setTimeout(
        () => setBalao(null),
        ATRASO_PRIMEIRO_BALAO +
          (falas.length - 1) * INTERVALO_ENTRE_BALOES +
          BALAO_NA_TELA,
      ),
    );

    return () => {
      for (const relogio of relogios) clearTimeout(relogio);
    };
  }, [pagina, ativo, aberto, ondeEstou]);

  // Abriu a conversa, o balão já cumpriu o papel dele.
  useEffect(() => {
    if (aberto) setBalao(null);
  }, [aberto]);

  /**
   * O mascote fala o aviso mais grave que ainda não falou.
   *
   * Uma vez, e não a cada carregamento de página: quem marca é o servidor
   * (`aoFalarAviso`), então o mesmo aviso não persegue a pessoa de tela em
   * tela. Com o painel aberto ele não fala — os cartões já estão à vista.
   */
  const faladoRef = useRef<string | null>(null);
  useEffect(() => {
    if (aberto || !avisosDoAstro || avisosDoAstro.length === 0) return;
    const aviso = avisoParaFalar(avisosDoAstro);
    if (!aviso || faladoRef.current === aviso.id) return;

    faladoRef.current = aviso.id;
    setBalao(aviso.titulo);
    aoFalarAviso?.(aviso.id);
    const relogio = setTimeout(() => setBalao(null), BALAO_NA_TELA);
    return () => clearTimeout(relogio);
  }, [aberto, avisosDoAstro, aoFalarAviso]);

  // Um botão de fora ("Falar com o Astro") abre o painel por evento: o
  // widget é montado uma vez no leiaute e ninguém tem a mão dele.
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(ABRIR_ASTRO, abrir);
    return () => window.removeEventListener(ABRIR_ASTRO, abrir);
  }, []);

  /**
   * Quem rolou até o fim ganha a conversa aberta.
   *
   * Chegar ao rodapé é ter visto tudo o que a página tinha a dizer — é o
   * momento em que puxar assunto deixa de ser interrupção e passa a ser a
   * próxima coisa a fazer.
   *
   * A conta é sobre a posição da página, e não sobre um elemento `<footer>`:
   * a home é cena 3D e não tem rodapé nenhum no DOM, e o único `<footer>` de
   * toda página é o do próprio painel do Astro — observá-lo abriria o painel
   * por causa do painel.
   *
   * E é RELÓGIO, não ouvinte de `scroll`. A home é conduzida pelo Lenis, que
   * roda a viagem no próprio laço e não emite `scroll` na janela: medido, zero
   * eventos numa rolagem de dezessete mil pixels, contra um evento na mesma
   * sonda dentro de uma página de solução. Perguntar de tempos em tempos não
   * depende de quem conduz a rolagem.
   *
   * Três décimos de segundo porque `scrollHeight` obriga o navegador a
   * recalcular layout, e a cena 3D não precisa disso sessenta vezes por
   * segundo. O relógio morre no instante do convite: ele é um só.
   */
  useEffect(() => {
    if (!ativo || aberto || jaConvidouNoRodape()) return;

    let seguidas = 0;
    const relogio = setInterval(() => {
      const pagina = document.documentElement;
      const tela = window.innerHeight;
      // Sem tela medida (aba oculta, painel embutido) toda página tem altura
      // zero, e "chegou ao fim" viraria verdade no carregamento.
      if (tela === 0) return;
      // A home cresce enquanto se rola, então o fim é recalculado sempre.
      const houveViagem = pagina.scrollHeight >= tela * VIAGEM_MINIMA;
      const noFim =
        window.scrollY + tela >= pagina.scrollHeight - MARGEM_DO_FIM;

      if (!houveViagem || !noFim) {
        seguidas = 0;
        return;
      }
      seguidas += 1;
      if (seguidas < CONFIRMACOES_DO_FIM) return;

      clearInterval(relogio);
      marcarConviteNoRodape();
      setAberto(true);
    }, INTERVALO_DE_ESPREITA);

    return () => clearInterval(relogio);
  }, [ativo, aberto]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            sessionId: sessaoRef.current ?? undefined,
            consent: consentimento,
            landingPage:
              typeof window === "undefined" ? undefined : window.location.href,
            // Onde ela está e por onde passou. A trilha vem do navegador e
            // sobe só agora, com a conversa começando — o servidor não guarda
            // navegação de quem nunca falou com a gente.
            pagina: paginaRef.current,
            trilha: trilhaRef.current,
            // Quem já se apresentou. Vai vazio quando ninguém se apresentou —
            // e é assim que ele sabe que ainda pode perguntar uma vez.
            visitante:
              Object.keys(visitanteRef.current).length > 0
                ? visitanteRef.current
                : undefined,
          },
        }),
        fetch: async (input, init) => {
          const resposta = await fetch(input as RequestInfo, init);
          // A sessão volta no cabeçalho porque o corpo é stream: sem ela, a
          // segunda mensagem abriria uma conversa nova a cada envio.
          const sessao = resposta.headers.get("x-astro-session");
          if (sessao) sessaoRef.current = sessao;
          // Recusa antes do stream (sem saldo, desligado, sessão cheia): quem
          // monta o widget decide o que mostrar — o próprio corpo vai junto.
          if (!resposta.ok) {
            const corpo = await resposta
              .clone()
              .json()
              .catch(() => null);
            setFalha({ status: resposta.status, corpo });
          }
          return resposta;
        },
      }),
    // `api` e o consentimento são fixos por montagem; o resto viaja por
    // referência para a conversa não remontar a cada navegação.
    [api, consentimento],
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    addToolApprovalResponse,
  } = useChat({
    transport,
    // Aprovou no cartão? A conversa segue sozinha, sem a pessoa ter que
    // escrever "pode" depois de já ter clicado em "pode".
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => onResposta?.(),
  });
  const carregando = status === "submitted" || status === "streaming";

  /** Quantos avisos ainda não foram lidos — o número do selo. */
  const naoLidos = (avisosDoAstro ?? []).filter((aviso) => !aviso.lido).length;

  /**
   * Os que ficam fixados no topo do painel: os não lidos, do mais grave para
   * o menos, no máximo três. A lista inteira empurraria a conversa para fora
   * da tela, que é o oposto do que um painel de conversa serve.
   */
  const avisosAbertos = [...(avisosDoAstro ?? [])]
    .filter((aviso) => !aviso.lido)
    .sort((a, b) => PESO[b.severidade] - PESO[a.severidade])
    .slice(0, 3);

  /**
   * A conversa atravessa a navegação.
   *
   * O Astro manda o link de uma solução, a pessoa clica, e o site troca de
   * página: o widget é remontado e a conversa morreria ali. Guardá-la é o que
   * permite o link ser um link — abrir na mesma aba, como todo link interno
   * do site — em vez de uma aba nova só para não perder o diagnóstico.
   *
   * Restaurar num efeito, e não no estado inicial, é o que mantém o HTML do
   * servidor igual ao primeiro render do cliente. O painel reabre um quadro
   * depois; ninguém percebe, e a hidratação não quebra.
   */
  const restaurado = useRef(false);
  useEffect(() => {
    if (restaurado.current) return;
    restaurado.current = true;
    visitanteRef.current = lerVisitante();

    const guardada = lerConversa();
    if (!guardada || guardada.messages.length === 0) return;

    sessaoRef.current = guardada.sessionId;
    setMessages(guardada.messages);
    setAberto(guardada.aberto);
  }, [setMessages]);

  /**
   * Quanto já foi escrito na conversa.
   *
   * É o gatilho da rolagem: cresce a cada pedaço do stream, então a conversa
   * acompanha o Astro enquanto ele escreve — e não só quando a mensagem
   * termina, que é o que aconteceria observando a lista de mensagens.
   */
  const escrito = messages.reduce(
    (soma, mensagem) =>
      soma +
      mensagem.parts.reduce(
        (parcial, parte) =>
          parcial + (parte.type === "text" ? parte.text.length : 1),
        0,
      ),
    0,
  );

  useEffect(() => {
    const corpo = corpoRef.current;
    if (!corpo || escrito === 0) return;
    corpo.scrollTo({ top: corpo.scrollHeight, behavior: "smooth" });
  }, [escrito]);

  /**
   * Sobe os arquivos escolhidos e guarda as partes prontas.
   *
   * O upload acontece na hora de anexar, não no envio: assim a pessoa vê a
   * miniatura antes de mandar, e uma imagem grande não trava o "Enviar".
   */
  const anexar = useCallback(
    async (arquivos: readonly File[]) => {
      if (!enviarArquivo || arquivos.length === 0) return;
      setErroDoAnexo(null);

      const aceitos = arquivos.filter((arquivo) =>
        tiposDeArquivo.includes(arquivo.type.toLowerCase()),
      );
      if (aceitos.length < arquivos.length) {
        setErroDoAnexo("Só consigo ler imagem JPEG, PNG ou WebP.");
      }
      if (aceitos.length === 0) return;

      const espaco = maxArquivos - anexos.length;
      if (espaco <= 0) {
        setErroDoAnexo(`No máximo ${maxArquivos} imagens por mensagem.`);
        return;
      }
      const escolhidos = aceitos.slice(0, espaco);
      if (escolhidos.length < aceitos.length) {
        setErroDoAnexo(`No máximo ${maxArquivos} imagens por mensagem.`);
      }

      setSubindo(true);
      try {
        for (const arquivo of escolhidos) {
          const parte = await enviarArquivo(arquivo);
          if (!parte) {
            setErroDoAnexo("Não consegui subir essa imagem. Tente de novo.");
            continue;
          }
          setAnexos((atuais) => [...atuais, parte]);
        }
      } finally {
        setSubindo(false);
      }
    },
    [anexos.length, enviarArquivo, maxArquivos, tiposDeArquivo],
  );

  /**
   * O que ele anotou sobre quem fala.
   *
   * A janela do orquestrador corta o histórico em dezesseis mensagens, então
   * um nome dito no primeiro turno some sozinho numa conversa longa. Aqui ele
   * é copiado da saída da tool para o navegador, e volta em toda requisição.
   */
  useEffect(() => {
    const ultima = messages.at(-1);
    if (!ultima || ultima.role !== "assistant") return;
    const achado = identidadeDaMensagem(ultima);
    if (!achado) return;
    const proximo = { ...visitanteRef.current, ...achado };
    visitanteRef.current = proximo;
    guardarVisitante(proximo);
  }, [messages]);

  // Guardar a cada pedaço do stream é barato (uma escrita em memória do
  // navegador) e evita perder a última resposta se a pessoa clicar num link
  // no meio dela.
  useEffect(() => {
    if (!restaurado.current || messages.length === 0) return;
    guardarConversa({
      sessionId: sessaoRef.current,
      aberto,
      messages,
    });
  }, [messages, aberto]);

  /**
   * O Astro falou e ninguém respondeu.
   *
   * É o único gatilho da cara emburrada, e ele vive aqui porque é aqui que se
   * sabe de quem foi a última palavra. Some assim que a pessoa manda algo — ou
   * assim que ela começa a digitar: cutucar quem já está escrevendo é
   * impaciência, não simpatia.
   */
  const ultimaEDoAstro = messages.at(-1)?.role === "assistant";
  const digitando = texto.trim().length > 0;

  useEffect(() => {
    setSemResposta(false);
    if (carregando || !ultimaEDoAstro || digitando) return;
    const relogio = setTimeout(() => setSemResposta(true), ESPERA_POR_RESPOSTA);
    return () => clearTimeout(relogio);
    // `carregando` basta para reiniciar a contagem a cada resposta: ele vai a
    // verdadeiro no envio e volta a falso quando o Astro termina de escrever.
  }, [carregando, ultimaEDoAstro, digitando]);

  /**
   * Fechar o painel — e reclamar, se a última palavra tiver sido dele.
   *
   * Mora num lugar só porque fechar tem dois caminhos (o × e o Esc), e a
   * queixa vale para os dois. É manipulador de evento, e não um efeito de
   * `aberto`, por causa da ordem: o efeito rodaria DEPOIS do que agenda os
   * balões da página, e a fala programada cobriria a queixa dois segundos
   * mais tarde.
   *
   * Marcar a página como falada é o que fecha essa porta — e faz sentido por
   * si: quem acabou de conversar aqui não precisa ouvir "essa é top hein" em
   * seguida.
   */
  /**
   * Recomeçar do zero.
   *
   * Existe porque uma conversa pode ficar grande demais para o servidor
   * carregar, e sem isto a pessoa ficava presa: o histórico guardado subia de
   * novo a cada tentativa, e nenhuma passava. Limpa a lista, o id da sessão e
   * o que estava guardado — a próxima mensagem abre sessão nova no servidor.
   */
  const recomecar = useCallback(() => {
    setMessages([]);
    setFalha(null);
    setErroDoAnexo(null);
    setAnexos([]);
    sessaoRef.current = null;
    esquecerConversa();
  }, [setMessages]);

  /**
   * Falar em vez de digitar.
   *
   * O que o navegador transcreve entra no campo, e não no envio: em português
   * o reconhecimento erra nome de produto e número, e mandar sozinho
   * transformaria cada engano numa pergunta paga.
   */
  const aoTranscrever = useCallback((falado: string) => {
    setTexto((atual) => (atual ? `${atual} ${falado}` : falado));
  }, []);
  const voz = useVoz(aoTranscrever);

  const fechar = useCallback(() => {
    setAberto(false);
    if (!ultimaEDoAstro) return;
    setBalao(FALA_SOZINHO);
    marcarQueFalou(ondeEstou);
  }, [ultimaEDoAstro, ondeEstou]);

  // A queixa sai de cena sozinha, como qualquer balão — e na hora, se a pessoa
  // voltar: reabrir o painel limpa o balão, o que cancela este relógio.
  useEffect(() => {
    if (balao !== FALA_SOZINHO) return;
    const relogio = setTimeout(() => setBalao(null), BALAO_NA_TELA);
    return () => clearTimeout(relogio);
  }, [balao]);

  // Fechar com Esc é o que todo mundo tenta primeiro num painel sobreposto.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar]);

  // Desligado no painel, o botão não aparece — quem atende é o WhatsApp dos
  // CTAs (barra, painéis e rodapé).
  if (!ativo) return null;

  /*
    Quem abre o painel lendo sobre um produto já disse do que veio atrás.

    Perguntar "o que está travando sua operação?" para quem está na página do
    CRM Tracking é ignorar o que a pessoa acabou de fazer. Então nas páginas de
    solução a abertura é sobre AQUELE produto, e as três sugestões viram as
    perguntas que alguém faz olhando para ele — inclusive uma sobre uma
    funcionalidade real, sorteada do catálogo.

    Fora delas (a home, os segmentos, o método) vale a abertura geral: ali ele
    ainda não sabe do que a pessoa veio atrás.
  */
  const abertura = ferramentaDaPagina
    ? `O que você espera de ${ferramentaDaPagina.nome}?`
    : (aberturaPadrao ?? pergunta);
  const sugestoes: Sugestao[] = ferramentaDaPagina
    ? [
        {
          texto: "Descobrir como pode servir pro meu negócio",
          envio: `Como o ${ferramentaDaPagina.nome} pode servir pro meu negócio?`,
          icone: ICONE_BUSCA,
        },
        {
          texto: "Saber os diferenciais",
          envio: `Quais são os diferenciais do ${ferramentaDaPagina.nome}?`,
          icone: ICONE_METODO,
        },
        {
          texto: `Saber sobre ${funcionalidadeEmDestaque}`,
          envio: `Me explica ${funcionalidadeEmDestaque}, do ${ferramentaDaPagina.nome}.`,
          icone: ICONE_SEGMENTO,
        },
      ]
    : sugestoesPadrao
      ? sugestoesPadrao.map((sugestao, indice) => ({
          ...sugestao,
          icone: [ICONE_BUSCA, ICONE_METODO, ICONE_SEGMENTO][indice % 3],
        }))
      : [
          {
            texto: "Descobrir o que serve pro meu negócio",
            envio:
              "Quero descobrir o que da ÓRBITA serve para o meu negócio. Pode me perguntar o que precisar.",
            icone: ICONE_BUSCA,
          },
          {
            texto: "Entender o Método N.A.S.A.",
            envio: "Como funciona o Método N.A.S.A.?",
            icone: ICONE_METODO,
          },
          // A terceira sai da mesma fonte que a estimativa: o painel nunca
          // convida para uma pergunta que o Astro não pode responder.
          precos
            ? {
                texto: "Estimar quanto ficaria",
                envio: "Quanto ficaria para a minha operação?",
                icone: ICONE_PRECO,
              }
            : {
                texto: "Ver as ferramentas por segmento",
                envio: "Quais ferramentas vocês têm para o meu segmento?",
                icone: ICONE_SEGMENTO,
              },
        ];

  const enviar = (mensagem: string) => {
    const limpo = mensagem.trim();
    // Imagem sem legenda vale como mensagem: "olha isto" é o texto que a
    // pessoa não escreveria de qualquer forma.
    if ((!limpo && anexos.length === 0) || carregando || subindo) return;
    setTexto("");
    setFalha(null);
    setErroDoAnexo(null);
    sendMessage({
      text: limpo || "Veja esta imagem.",
      ...(anexos.length > 0 ? { files: anexos } : {}),
    });
    setAnexos([]);
  };

  if (!aberto) {
    return (
      <>
        {balao && (
          /*
            O balão é clicável e abre a conversa: quem se interessou pela fala
            não deveria ter que mirar no ícone ao lado.

            `aria-live` para quem usa leitor de tela ouvir a fala aparecer —
            um mascote que só existe para quem enxerga é meio mascote.
          */
          <button
            type="button"
            className="o-astro-balao"
            aria-live="polite"
            onClick={() => setAberto(true)}
          >
            {balao}
          </button>
        )}
        <button
          ref={botaoRef}
          type="button"
          className="o-astro-btn"
          onClick={() => setAberto(true)}
          aria-label={
            naoLidos > 0
              ? `Falar com o Astro (${naoLidos} avisos)`
              : "Falar com o Astro"
          }
        >
          {naoLidos > 0 && (
            <span className="o-astro-selo" aria-hidden>
              {naoLidos > 9 ? "9+" : naoLidos}
            </span>
          )}
          {/*
            O botão se entrega ao mascote: é o DISCO que treme e esquenta
            quando ele se dá por ignorado, não só o desenho lá dentro.
          */}
          <AstroMark vigiaInercia corpo={botaoRef} />
        </button>
      </>
    );
  }

  return (
    <div
      className="o-astro-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Astro, consultor da ÓRBITA"
    >
      <header className="o-astro-head">
        <AstroMark
          className="o-astro-head__mark"
          // Falando, ele não fica bravo: `carregando` corta a zanga na
          // origem, sem depender de o relógio dos 6s já ter sido zerado.
          zangado={semResposta && !carregando}
        />
        <span className="o-astro-head__name">Astro</span>
        {messages.length > 0 && (
          <button
            type="button"
            className="o-astro-head__novo"
            onClick={recomecar}
            aria-label="Começar uma conversa nova"
            title="Começar uma conversa nova"
          >
            Nova conversa
          </button>
        )}
        <button
          type="button"
          className="o-astro-head__close"
          onClick={fechar}
          aria-label="Fechar"
        >
          ×
        </button>
      </header>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrastar arquivo é atalho; o botão de anexo continua sendo o caminho acessível. */}
      <div
        className={
          arrastando ? "o-astro-body o-astro-body--drop" : "o-astro-body"
        }
        ref={corpoRef}
        onDragOver={
          enviarArquivo
            ? (e) => {
                e.preventDefault();
                setArrastando(true);
              }
            : undefined
        }
        onDragLeave={enviarArquivo ? () => setArrastando(false) : undefined}
        onDrop={
          enviarArquivo
            ? (e) => {
                e.preventDefault();
                setArrastando(false);
                void anexar([...e.dataTransfer.files]);
              }
            : undefined
        }
      >
        {avisosAbertos.length > 0 && (
          <div className="o-astro-avisos">
            {avisosAbertos.map((aviso) => (
              <div
                className={`o-astro-aviso o-astro-aviso--${aviso.severidade}`}
                key={aviso.id}
              >
                <p className="o-astro-aviso__titulo">{aviso.titulo}</p>
                <p className="o-astro-aviso__corpo">{aviso.corpo}</p>
                <div className="o-astro-aviso__botoes">
                  <button
                    type="button"
                    className="o-astro-aviso__explicar"
                    onClick={() => {
                      aoLerAviso?.(aviso.id);
                      enviar(`Me explica este aviso: ${aviso.titulo}`);
                    }}
                  >
                    Explicar
                  </button>
                  <button
                    type="button"
                    className="o-astro-aviso__ok"
                    onClick={() => aoLerAviso?.(aviso.id)}
                  >
                    Já vi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="o-astro-empty">
            <h2 className="o-astro-empty__title">{abertura}</h2>
            {sugestoes.map((sugestao) => (
              <button
                type="button"
                key={sugestao.texto}
                className="o-astro-suggest"
                onClick={() => enviar(sugestao.envio)}
              >
                <span className="o-astro-suggest__icon">{sugestao.icone}</span>
                {sugestao.texto}
              </button>
            ))}
          </div>
        ) : (
          <>
            {messages.map((mensagem) => {
              const texto = mensagem.parts
                .map((parte) => (parte.type === "text" ? parte.text : ""))
                .join("");
              const solucoes =
                mensagem.role === "user" ? [] : solucoesDaMensagem(mensagem);
              const formulario =
                mensagem.role === "user"
                  ? null
                  : formularioDaMensagem(mensagem);
              const aprovacoes =
                mensagem.role === "user" ? [] : pedidosDeAprovacao(mensagem);
              const links =
                mensagem.role === "user" ? [] : linksDaMensagem(mensagem);
              const imagens =
                mensagem.role === "user" ? [] : imagensDaMensagem(mensagem);
              const arquivos = anexosDaMensagem(mensagem);
              if (
                !texto &&
                solucoes.length === 0 &&
                !formulario &&
                aprovacoes.length === 0 &&
                links.length === 0 &&
                imagens.length === 0 &&
                arquivos.length === 0
              ) {
                return null;
              }

              return (
                <Fragment key={mensagem.id}>
                  {arquivos.length > 0 && (
                    <div
                      className={
                        mensagem.role === "user"
                          ? "o-astro-fotos o-astro-fotos--user"
                          : "o-astro-fotos"
                      }
                    >
                      {arquivos.map((arquivo) => (
                        // biome-ignore lint/performance/noImgElement: o pacote roda no site e no app e não depende do next/image.
                        <img
                          key={arquivo.url}
                          className="o-astro-foto"
                          src={arquivo.url}
                          alt={arquivo.filename ?? "Imagem anexada"}
                        />
                      ))}
                    </div>
                  )}

                  {texto && (
                    <div
                      className={
                        mensagem.role === "user"
                          ? "o-astro-msg o-astro-msg--user"
                          : "o-astro-msg o-astro-msg--astro"
                      }
                    >
                      {texto}
                    </div>
                  )}

                  {solucoes.length > 0 && (
                    <div className="o-astro-links">
                      <p className="o-astro-links__titulo">
                        {solucoes.length === 1
                          ? "Veja a página"
                          : "Veja as páginas"}
                      </p>
                      {solucoes.map((solucao) => (
                        <a
                          key={solucao.id}
                          className="o-astro-link"
                          href={`${baseDosLinks}${solucao.href}`}
                          target={linksEmNovaAba ? "_blank" : undefined}
                          rel={
                            linksEmNovaAba ? "noopener noreferrer" : undefined
                          }
                        >
                          <span className="o-astro-link__texto">
                            <span className="o-astro-link__nome">
                              {solucao.nome}
                            </span>
                            {solucao.tagline && (
                              <span className="o-astro-link__linha">
                                {solucao.tagline}
                              </span>
                            )}
                          </span>
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            aria-hidden
                          >
                            <title>Abrir</title>
                            <path
                              d="M9 6l6 6-6 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}

                  {aprovacoes.map((pedido) => {
                    const rotulo = acoes?.[pedido.ferramenta];
                    return (
                      <div className="o-astro-acao" key={pedido.id}>
                        <p className="o-astro-acao__titulo">
                          {rotulo?.titulo ?? pedido.ferramenta}
                        </p>
                        <p className="o-astro-acao__linha">
                          {rotulo?.resumir(pedido.entrada) ??
                            "Confirme para o Astro executar."}
                        </p>
                        {pedido.respondido ? (
                          <p className="o-astro-acao__estado">
                            {pedido.recusado ? "Recusado." : "Confirmado."}
                          </p>
                        ) : (
                          <div className="o-astro-acao__botoes">
                            <button
                              type="button"
                              className="o-astro-acao__sim"
                              onClick={() =>
                                addToolApprovalResponse({
                                  id: pedido.id,
                                  approved: true,
                                })
                              }
                            >
                              Pode fazer
                            </button>
                            <button
                              type="button"
                              className="o-astro-acao__nao"
                              onClick={() =>
                                addToolApprovalResponse({
                                  id: pedido.id,
                                  approved: false,
                                })
                              }
                            >
                              Agora não
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {imagens.length > 0 && (
                    <div className="o-astro-fotos">
                      {imagens.map((imagem) => (
                        // biome-ignore lint/performance/noImgElement: o pacote roda no site e no app e não depende do next/image.
                        <img
                          key={imagem.url}
                          className="o-astro-foto"
                          src={imagem.url}
                          alt={imagem.descricao || "Imagem gerada pelo Astro"}
                        />
                      ))}
                    </div>
                  )}

                  {links.length > 0 && (
                    <div className="o-astro-links">
                      {links.map((link) => (
                        <a
                          key={link.href}
                          className="o-astro-link"
                          href={`${baseDosLinks}${link.href}`}
                          target={linksEmNovaAba ? "_blank" : undefined}
                          rel={
                            linksEmNovaAba ? "noopener noreferrer" : undefined
                          }
                        >
                          <span className="o-astro-link__texto">
                            <span className="o-astro-link__nome">
                              {link.rotulo}
                            </span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}

                  {formulario && (
                    /*
                      Abre em aba nova de propósito: o formulário mora em outro
                      domínio, e sair do site levaria a conversa junto. Assim a
                      pessoa preenche e volta para o Astro ainda aberto.
                    */
                    <div className="o-astro-cta">
                      {formulario.motivo && (
                        <p className="o-astro-cta__linha">
                          {formulario.motivo}
                        </p>
                      )}
                      <a
                        className="o-astro-cta__btn"
                        href={formulario.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {formulario.rotulo}
                      </a>
                    </div>
                  )}
                </Fragment>
              );
            })}
            {falha &&
              (aoFalhar?.(falha) ?? (
                <div className="o-astro-msg o-astro-msg--astro">
                  {mensagemDaFalha(falha)}
                </div>
              ))}
            {carregando && (
              // `<output>` já é `role="status"` por natureza: o leitor de tela
              // anuncia sozinho que o Astro começou a escrever.
              <output className="o-astro-typing" aria-label="Astro escrevendo">
                <span />
                <span />
                <span />
              </output>
            )}
          </>
        )}
      </div>

      <footer className="o-astro-foot">
        {(anexos.length > 0 || subindo || erroDoAnexo) && (
          <div className="o-astro-anexos">
            {anexos.map((anexo, indice) => (
              <span className="o-astro-anexo" key={anexo.url}>
                {/* biome-ignore lint/performance/noImgElement: o pacote roda no site e no app e não depende do next/image. */}
                <img
                  className="o-astro-anexo__mini"
                  src={anexo.url}
                  alt={anexo.filename ?? "Anexo"}
                />
                <button
                  type="button"
                  className="o-astro-anexo__x"
                  aria-label={`Remover ${anexo.filename ?? "anexo"}`}
                  onClick={() =>
                    setAnexos((atuais) => atuais.filter((_, i) => i !== indice))
                  }
                >
                  ×
                </button>
              </span>
            ))}
            {subindo && <span className="o-astro-anexo__aviso">Subindo…</span>}
            {erroDoAnexo && (
              <span className="o-astro-anexo__erro">{erroDoAnexo}</span>
            )}
          </div>
        )}

        <form
          className="o-astro-form"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
        >
          {enviarArquivo && (
            <>
              <input
                ref={seletorRef}
                type="file"
                accept={tiposDeArquivo.join(",")}
                multiple
                hidden
                onChange={(e) => {
                  void anexar([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="o-astro-clip"
                aria-label="Anexar imagem"
                disabled={subindo || anexos.length >= maxArquivos}
                onClick={() => seletorRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <title>Anexar</title>
                  <path
                    d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 1 1 5 5l-8 8a2 2 0 1 1-3-3l7.5-7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
            </>
          )}
          {voz.suportado && (
            <button
              type="button"
              className={
                voz.estado === "ouvindo"
                  ? "o-astro-voz o-astro-voz--ouvindo"
                  : "o-astro-voz"
              }
              aria-label={
                voz.estado === "ouvindo"
                  ? "Parar de ouvir"
                  : "Falar com o Astro"
              }
              aria-pressed={voz.estado === "ouvindo"}
              title={
                voz.estado === "ouvindo"
                  ? "Ouvindo… clique para parar"
                  : "Falar com o Astro"
              }
              disabled={carregando}
              onClick={voz.alternar}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <title>Falar</title>
                {voz.estado === "ouvindo" ? (
                  <rect
                    x="7"
                    y="7"
                    width="10"
                    height="10"
                    rx="2"
                    fill="currentColor"
                  />
                ) : (
                  <>
                    <rect
                      x="9"
                      y="3"
                      width="6"
                      height="11"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                    />
                    <path
                      d="M5 11a7 7 0 0 0 14 0M12 18v3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </>
                )}
              </svg>
            </button>
          )}
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onPaste={
              enviarArquivo
                ? (e) => {
                    const arquivos = [...e.clipboardData.files];
                    if (arquivos.length === 0) return;
                    // Print da tela colado no campo: não deixa virar o nome
                    // do arquivo escrito no meio da pergunta.
                    e.preventDefault();
                    void anexar(arquivos);
                  }
                : undefined
            }
            placeholder={
              voz.estado === "ouvindo" ? "Ouvindo…" : "Pergunte ao Astro…"
            }
            maxLength={2000}
            aria-label="Sua mensagem"
          />
          <button
            type="submit"
            className="o-astro-send"
            disabled={
              (!texto.trim() && anexos.length === 0) || carregando || subindo
            }
            aria-label="Enviar"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <title>Enviar</title>
              <path
                d="M4 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        </form>

        {whatsappHref && (
          <a
            className="o-astro-human"
            href={whatsappHref}
            target="_blank"
            rel="noreferrer noopener"
          >
            Falar com uma pessoa
          </a>
        )}

        <p className="o-astro-note">
          {nota ??
            "O Astro é uma inteligência artificial e pode errar. Ao conversar, você concorda que a gente guarde o que for combinado para o time entrar em contato."}
        </p>
      </footer>
    </div>
  );
}
