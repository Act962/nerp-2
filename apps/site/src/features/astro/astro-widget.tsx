"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { findToolBySlug } from "@/orbita/data/catalog";
import { useSiteContent } from "@/orbita/lib/content-context";
import { AstroMark } from "./astro-mark";
import type { PaginaDoAstro } from "./pagina";
import "./astro-widget.css";

/**
 * O consultor no site.
 *
 * O botão fica no lugar onde o do WhatsApp ficava — e o WhatsApp não some do
 * site: virou a saída "falar com uma pessoa" dentro do painel, e o que aparece
 * quando o Astro está desligado ou sem resposta. Sem isso, trocar o ícone
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

/** A saudação muda com a hora, como na referência. */
function perguntaDaHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "O que está travando sua operação esta manhã?";
  if (hora < 18) return "O que está travando sua operação hoje?";
  return "O que está travando sua operação esta noite?";
}

export function AstroWidget({ pagina }: { pagina?: PaginaDoAstro }) {
  const { astro, whatsapp } = useSiteContent();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pergunta, setPergunta] = useState("O que está travando sua operação?");
  const [semResposta, setSemResposta] = useState(false);
  const [balao, setBalao] = useState<string | null>(null);
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
  const ferramentaDaPagina = useMemo(
    () => (pagina ? findToolBySlug(pagina.slug) : null),
    [pagina],
  );

  /*
    Uma funcionalidade da ferramenta, sorteada uma vez por montagem.

    Sorteada, e não a primeira, porque quem volta à página encontra um convite
    diferente — e porque a primeira do catálogo não é necessariamente a mais
    interessante de perguntar.
  */
  const funcionalidadeEmDestaque = useMemo(() => {
    const lista = ferramentaDaPagina?.features ?? [];
    if (lista.length === 0) return "";
    return lista[Math.floor(Math.random() * lista.length)].title.toLowerCase();
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
      !astro.ativo ||
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
  }, [pagina, astro.ativo, aberto, ondeEstou]);

  // Abriu a conversa, o balão já cumpriu o papel dele.
  useEffect(() => {
    if (aberto) setBalao(null);
  }, [aberto]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/astro/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            sessionId: sessaoRef.current ?? undefined,
            consent: true,
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
          return resposta;
        },
      }),
    [],
  );

  const { messages, sendMessage, setMessages, status } = useChat({
    transport,
  });
  const carregando = status === "submitted" || status === "streaming";

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

  // Desligado no painel, o botão não aparece — quem atende é o WhatsApp, que
  // continua montado na experiência.
  if (!astro.ativo) return null;

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
    ? `O que você espera de ${ferramentaDaPagina.name}?`
    : pergunta;
  const sugestoes: Sugestao[] = ferramentaDaPagina
    ? [
        {
          texto: "Descobrir como pode servir pro meu negócio",
          envio: `Como o ${ferramentaDaPagina.name} pode servir pro meu negócio?`,
          icone: ICONE_BUSCA,
        },
        {
          texto: "Saber os diferenciais",
          envio: `Quais são os diferenciais do ${ferramentaDaPagina.name}?`,
          icone: ICONE_METODO,
        },
        {
          texto: `Saber sobre ${funcionalidadeEmDestaque}`,
          envio: `Me explica ${funcionalidadeEmDestaque}, do ${ferramentaDaPagina.name}.`,
          icone: ICONE_SEGMENTO,
        },
      ]
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
        astro.precos
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
    if (!limpo || carregando) return;
    setTexto("");
    sendMessage({ text: limpo });
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
          aria-label="Falar com o Astro"
        >
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
        <button
          type="button"
          className="o-astro-head__close"
          onClick={fechar}
          aria-label="Fechar"
        >
          ×
        </button>
      </header>

      <div className="o-astro-body" ref={corpoRef}>
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
              if (!texto && solucoes.length === 0 && !formulario) return null;

              return (
                <Fragment key={mensagem.id}>
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
                          href={solucao.href}
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
        <form
          className="o-astro-form"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pergunte ao Astro…"
            maxLength={2000}
            aria-label="Sua mensagem"
          />
          <button
            type="submit"
            className="o-astro-send"
            disabled={!texto.trim() || carregando}
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

        <a
          className="o-astro-human"
          href={whatsapp.href}
          target="_blank"
          rel="noreferrer noopener"
        >
          Falar com uma pessoa
        </a>

        <p className="o-astro-note">
          O Astro é uma inteligência artificial e pode errar. Ao conversar, você
          concorda que a gente guarde o que for combinado para o time entrar em
          contato.
        </p>
      </footer>
    </div>
  );
}
