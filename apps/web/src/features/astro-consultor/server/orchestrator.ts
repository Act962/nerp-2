import "server-only";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import type { AstroPricing } from "./preco";
import {
  type ContextoDeNavegacao,
  type EscopoConsultor,
  montarPrompt,
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
 * Quantas falas do visitante alimentam a busca por ferramenta.
 *
 * Três, e não uma: a última costuma ser um "sim, pode buscar", e a dor de
 * verdade ficou dois turnos atrás. Três pega o problema sem arrastar a
 * conversa inteira para dentro da busca.
 */
const FALAS_PARA_A_BUSCA = 3;

/** O que o visitante escreveu, com as palavras dele. */
function falaDoVisitante(mensagens: UIMessage[]): string {
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
  /** Onde a pessoa está no site e por onde passou nesta visita. */
  navegacao?: ContextoDeNavegacao;
  onFinish?: (dados: { tokensIn: number; tokensOut: number }) => Promise<void>;
};

// `convertToModelMessages` é assíncrono no `ai@7` (no `ai@6`, que é o do
// Órbita, era síncrono). Sem o await, o que chega em `streamText` é uma
// Promise e o erro sai lá dentro, como "messages.some is not a function".
export async function streamAstroConsultor(entrada: EntradaConsultor) {
  const recentes = entrada.mensagens.slice(-JANELA_DE_MENSAGENS);
  const tools = construirTools({
    sessaoId: entrada.sessaoId,
    tabelaPrecos: entrada.tabelaPrecos,
    falaDoVisitante: falaDoVisitante(recentes),
  });

  return streamText({
    model: entrada.modelo.modelo,
    system: montarPrompt({
      escopo: entrada.escopo,
      organizacao: entrada.organizacao,
      navegacao: entrada.navegacao,
    }),
    // As tools vão junto: é assim que o conversor reconhece as partes de
    // chamada de ferramenta que já estão no histórico do cliente.
    messages: await convertToModelMessages(recentes, { tools }),
    tools,
    // Respostas de três a cinco linhas: o teto é folga, não meta.
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
