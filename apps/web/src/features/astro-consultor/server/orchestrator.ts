import "server-only";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai";
import type { AstroPricing } from "./preco";
import {
  type AvisoNoPrompt,
  type ContextoDeNavegacao,
  type EscopoConsultor,
  type FatoNaMemoria,
  montarPrompt,
  type Visitante,
} from "./prompt";
import type { ModeloResolvido } from "./provider";
import { construirTools } from "./tools";

/**
 * O orquestrador do consultor.
 *
 * A diferença deliberada em relação ao ASTRO do Órbita: aqui o contexto de
 * usuário e organização é OPCIONAL, e o conjunto de tools chega pronto. Lá,
 * `streamAstro` exige `userId` e `organizationId` na assinatura e consulta a
 * configuração da organização na primeira linha — é por isso que aquele
 * orquestrador não atende visitante anônimo, e é por isso que este existe.
 *
 * Os dois canais (site anônimo e app logado) chamam esta mesma função; o que
 * muda entre eles é a guarda da rota e as tools que ela monta.
 */

/**
 * Quantas mensagens do histórico vão para o modelo.
 *
 * Sem corte, o custo de uma conversa cresce ao quadrado: cada mensagem nova
 * reenvia todas as anteriores. Trinta turnos numa sessão com prompt de ~3k
 * tokens é a diferença entre centavos e reais por visitante.
 */
const JANELA_DE_MENSAGENS = 16;

/**
 * O que o `streamText` aceita em `providerOptions`, derivado dele mesmo — o
 * tipo mora em `@ai-sdk/provider-utils`, que não é dependência direta do app.
 */
type OpcoesDoProvedor = NonNullable<
  Parameters<typeof streamText>[0]["providerOptions"]
>;

/**
 * Quantas mensagens da ABERTURA sobrevivem ao corte.
 *
 * Cortar só pelo fim custava caro numa coisa específica: a pessoa se apresenta
 * no começo ("aqui é o Weydson, do Santa Clara"), e no décimo sétimo turno
 * aquilo simplesmente sumia do contexto — e o Astro perguntava o nome de novo,
 * que é exatamente o que ele não pode fazer.
 *
 * Duas mensagens custam quase nada e cobrem a apresentação, que é onde ela
 * quase sempre acontece. Não substituem `anotarQuemFala`: o memorando atravessa
 * a navegação entre páginas, este corte atravessa a conversa longa.
 */
const ABERTURA_PRESERVADA = 2;

/**
 * Tira do histórico as ações que ficaram esperando um sim que nunca veio.
 *
 * O cartão de aprovação para a tool e deixa, no histórico do cliente, uma
 * chamada de ferramenta SEM resultado. Se a pessoa digitar qualquer coisa em
 * vez de responder no cartão, esse histórico volta para cá com a chamada
 * pendurada — e a OpenAI recusa a requisição inteira com "No tool output found
 * for function call", porque a API dela exige que toda chamada tenha saída.
 *
 * Pior: a conversa fica guardada no navegador, então a chamada pendurada volta
 * a cada tentativa seguinte e nenhuma passa. Uma conversa morta para sempre.
 *
 * Por isso a limpeza é aqui, no servidor, e não no cliente: o histórico é
 * postado pelo navegador, e o que chega dele nunca é premissa. Pedido sem
 * resposta é pedido que não aconteceu — o modelo propõe de novo se ainda fizer
 * sentido. Aprovado (`approval-responded`) e recusado (`output-denied`) ficam:
 * esses o SDK sabe resolver.
 */
export function semAprovacoesPendentes(mensagens: UIMessage[]): UIMessage[] {
  return mensagens.map((mensagem) => {
    if (mensagem.role !== "assistant") return mensagem;
    const partes = mensagem.parts.filter((parte) => {
      if (!parte.type.startsWith("tool-")) return true;
      return (parte as { state?: string }).state !== "approval-requested";
    });
    return partes.length === mensagem.parts.length
      ? mensagem
      : { ...mensagem, parts: partes };
  });
}

/** A janela do modelo: a abertura, mais o fim recente. */
function janela(mensagens: UIMessage[]): UIMessage[] {
  if (mensagens.length <= JANELA_DE_MENSAGENS) return mensagens;
  return [
    ...mensagens.slice(0, ABERTURA_PRESERVADA),
    ...mensagens.slice(-(JANELA_DE_MENSAGENS - ABERTURA_PRESERVADA)),
  ];
}

/**
 * Quantas falas do visitante alimentam a busca por ferramenta.
 *
 * Três, e não uma: a última costuma ser um "sim, pode buscar", e a dor de
 * verdade ficou dois turnos atrás. Três pega o problema sem arrastar a
 * conversa inteira para dentro da busca.
 */
const FALAS_PARA_A_BUSCA = 3;

/** O que o visitante escreveu, com as palavras dele. */
export function falaDoVisitante(mensagens: UIMessage[]): string {
  return mensagens
    .filter((mensagem) => mensagem.role === "user")
    .slice(-FALAS_PARA_A_BUSCA)
    .map((mensagem) =>
      mensagem.parts
        .map((parte) => (parte.type === "text" ? parte.text : ""))
        .join(" "),
    )
    .join(" ")
    .slice(0, 1000);
}

export type EntradaConsultor = {
  escopo: EscopoConsultor;
  sessaoId: string;
  tabelaPrecos: AstroPricing;
  modelo: ModeloResolvido;
  mensagens: UIMessage[];
  organizacao?: string;
  /** Só no canal logado: quem está falando, pelo nome da conta. */
  usuario?: string;
  /** Onde a pessoa está no site e por onde passou nesta visita. */
  navegacao?: ContextoDeNavegacao;
  /** Nome, empresa e CNPJ que ela já deu — para ele não perguntar de novo. */
  visitante?: Visitante;
  /** Só no canal logado: avisos abertos e memória da organização. */
  avisos?: AvisoNoPrompt[];
  memoria?: FatoNaMemoria[];
  /**
   * As tools prontas, quando quem chama já as montou — é o caso do canal
   * logado, cujas tools carregam `organizationId` em closure. Ausente, valem
   * as do site.
   */
  tools?: ToolSet;
  /**
   * Quais tools param e pedem o sim da pessoa antes de executar. O segredo
   * assina o pedido: sem ele, o cliente que reenvia o próprio histórico com
   * `approved: true` executaria a ação sozinho.
   */
  toolApproval?: Record<string, "user-approval">;
  approvalSecret?: string;
  /**
   * O que vai para o provedor além do prompt — no canal logado, a resolução
   * com que ele olha as imagens anexadas.
   */
  providerOptions?: OpcoesDoProvedor;
  /**
   * Um passo voltou com fontes da web. É o único sinal confiável de que a
   * busca do provedor rodou de verdade: ela acontece dentro da chamada, sem
   * passar por `execute` nenhum, então não há tool para contar.
   */
  aoBuscarNaWeb?: () => void;
  /**
   * Uma tool terminou. Serve para o log estruturado de quem chamou o quê e
   * quanto demorou — sem o argumento e sem a resposta, que são a conversa da
   * pessoa e não têm por que ir para o log do servidor.
   */
  aoTerminarTool?: (evento: {
    tool: string;
    duracaoMs: number;
    falhou: boolean;
  }) => void;
  onFinish?: (dados: { tokensIn: number; tokensOut: number }) => Promise<void>;
};

// `convertToModelMessages` é assíncrono no `ai@7` (no `ai@6`, que é o do
// Órbita, era síncrono). Sem o await, o que chega em `streamText` é uma
// Promise e o erro sai lá dentro, como "messages.some is not a function".
export async function streamAstroConsultor(entrada: EntradaConsultor) {
  const recentes = janela(semAprovacoesPendentes(entrada.mensagens));
  const tools =
    entrada.tools ??
    construirTools({
      sessaoId: entrada.sessaoId,
      tabelaPrecos: entrada.tabelaPrecos,
      falaDoVisitante: falaDoVisitante(recentes),
    });

  return streamText({
    model: entrada.modelo.modelo,
    system: montarPrompt({
      escopo: entrada.escopo,
      organizacao: entrada.organizacao,
      usuario: entrada.usuario,
      navegacao: entrada.navegacao,
      visitante: entrada.visitante,
      avisos: entrada.avisos,
      memoria: entrada.memoria,
    }),
    // As tools vão junto: é assim que o conversor reconhece as partes de
    // chamada de ferramenta que já estão no histórico do cliente.
    messages: await convertToModelMessages(recentes, { tools }),
    tools,
    // Respostas de três a cinco linhas: o teto é folga, não meta.
    ...(entrada.toolApproval ? { toolApproval: entrada.toolApproval } : {}),
    ...(entrada.approvalSecret
      ? { experimental_toolApprovalSecret: entrada.approvalSecret }
      : {}),
    ...(entrada.providerOptions
      ? { providerOptions: entrada.providerOptions }
      : {}),
    onStepEnd: ({ sources }) => {
      if (sources.length > 0) entrada.aoBuscarNaWeb?.();
    },
    onToolExecutionEnd: ({ toolCall, toolExecutionMs, toolOutput }) => {
      entrada.aoTerminarTool?.({
        tool: toolCall.toolName,
        duracaoMs: Math.round(toolExecutionMs),
        falhou: toolOutput.type === "tool-error",
      });
    },
    maxOutputTokens: 1024,
    temperature: 0.3,
    // Busca → detalhe → estimativa → registro cabe com sobra. Sem parada, uma
    // conversa mal conduzida vira um laço de tools pago por chamada.
    stopWhen: stepCountIs(8),
    onFinish: async ({ usage }) => {
      await entrada.onFinish?.({
        tokensIn: usage.inputTokens ?? 0,
        tokensOut: usage.outputTokens ?? 0,
      });
    },
  });
}
