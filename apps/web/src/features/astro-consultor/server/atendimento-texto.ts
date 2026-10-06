/**
 * O texto que atravessa a ponte para o Chat do Órbita.
 *
 * Fica separado de `atendimento.ts` porque é função pura: quem monta o pedido
 * e quem lê as respostas não precisa de banco nem de rede, e assim dá para
 * testar o formato sem subir nada.
 */

/** O teto de uma mensagem no ASTRO CHAT (`MESSAGE_MAX_CHARS` do Órbita). */
export const LIMITE_DO_CHAT = 2000;

export type DadosDoPedido = {
  /** Por que a pessoa quer falar com alguém, nas palavras dela ou do Astro. */
  motivo?: string;
  /** O que já foi conversado, em poucas linhas. */
  resumo?: string;
  nome?: string;
  empresa?: string;
  contato?: string;
  /** A página em que ela estava quando pediu. */
  pagina?: string;
};

const limpar = (valor: string | undefined) =>
  (valor ?? "").replace(/\s+/g, " ").trim();

/**
 * A primeira mensagem da conversa, como a equipe vai ler no Chat.
 *
 * Ela chega como se fosse do visitante — é o único tipo de mensagem que a rota
 * pública aceita. Por isso abre dizendo o que é: sem a primeira linha, quem
 * atende veria um parágrafo em terceira pessoa "escrito" pelo cliente.
 *
 * Linha vazia não entra: campo que ninguém informou não vira "Nome: —".
 */
export function montarPedido(dados: DadosDoPedido): string {
  const linhas = [
    "Pedido de atendimento humano pelo Astro do site.",
    limpar(dados.nome) && `Nome: ${limpar(dados.nome)}`,
    limpar(dados.empresa) && `Empresa: ${limpar(dados.empresa)}`,
    limpar(dados.contato) && `Contato: ${limpar(dados.contato)}`,
    limpar(dados.pagina) && `Página: ${limpar(dados.pagina)}`,
    limpar(dados.motivo) && `Motivo: ${limpar(dados.motivo)}`,
    limpar(dados.resumo) && `Resumo da conversa: ${limpar(dados.resumo)}`,
  ].filter((linha): linha is string => Boolean(linha));

  return cortar(linhas.join("\n"));
}

/** Corta no teto do Chat: mensagem maior é recusada inteira do outro lado. */
export function cortar(texto: string): string {
  const limpo = texto.trim();
  return limpo.length <= LIMITE_DO_CHAT
    ? limpo
    : `${limpo.slice(0, LIMITE_DO_CHAT - 1)}…`;
}

/** Uma mensagem como o ASTRO CHAT devolve (`PublicMessage` do Órbita). */
export type MensagemDoChat = {
  id: string;
  body: string;
  author: "visitor" | "astro" | "team";
  senderName: string | null;
  createdAt: string;
};

/** O que o widget do site desenha. */
export type RespostaDaEquipe = {
  id: string;
  texto: string;
  /** Quem escreveu: uma pessoa do time, ou o aviso automático do Chat. */
  autor: "equipe" | "astro";
  nome: string | null;
  em: string;
};

function ehMensagemDoChat(valor: unknown): valor is MensagemDoChat {
  if (typeof valor !== "object" || valor === null) return false;
  const m = valor as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.body === "string" &&
    typeof m.createdAt === "string" &&
    (m.author === "visitor" || m.author === "astro" || m.author === "team")
  );
}

/**
 * Separa o que é resposta do que é eco.
 *
 * A rota devolve TODAS as mensagens depois do cursor, inclusive as do próprio
 * visitante. O widget já as tem na tela — mostrá-las de novo duplicaria cada
 * frase. Mas o cursor anda sobre todas: se ele parasse na última resposta, a
 * próxima consulta traria de volta o que o visitante escreveu depois dela.
 *
 * O que vem da rede não é premissa: item fora do formato é descartado, em vez
 * de derrubar a consulta inteira.
 */
export function lerMensagens(bruto: unknown): {
  respostas: RespostaDaEquipe[];
  cursor: string | null;
} {
  const itens =
    typeof bruto === "object" && bruto !== null
      ? (bruto as { items?: unknown }).items
      : null;
  const mensagens = Array.isArray(itens) ? itens.filter(ehMensagemDoChat) : [];

  return {
    respostas: mensagens
      .filter((m) => m.author !== "visitor" && m.body.trim().length > 0)
      .map((m) => ({
        id: m.id,
        texto: m.body,
        autor: m.author === "team" ? ("equipe" as const) : ("astro" as const),
        nome: m.senderName,
        em: m.createdAt,
      })),
    cursor: mensagens.at(-1)?.id ?? null,
  };
}
