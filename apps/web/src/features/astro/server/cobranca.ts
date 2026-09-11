import "server-only";

import { custoDeTokens } from "@/features/stars/lib/uso";
import {
  ACOES,
  cobrarAteOSaldo,
  custoDaAcao,
  podePagar,
} from "@/features/stars/server/debitar";

/**
 * A cobrança do Astro em ★.
 *
 * Tokens só existem quando a resposta termina, e a essa altura ela já foi
 * entregue: por isso `cobrarAteOSaldo`, que debita o que houver e nunca deixa
 * a conta negativa, e não `cobrarAcao`, que recusa. O que segura o gasto é o
 * pré-check da rota — sem saldo para o menor bloco, a mensagem nem começa.
 */

/** Quanto custa começar uma mensagem: um bloco de tokens. Zero = não cobra. */
export async function precoDoAstro(organizationId: string): Promise<number> {
  return custoDaAcao(organizationId, ACOES.astroTokens);
}

/** Há saldo para pelo menos um bloco? Sem preço (cobrança desligada), sempre. */
export async function podeConversar(organizationId: string): Promise<boolean> {
  const preco = await precoDoAstro(organizationId);
  if (preco <= 0) return true;
  return podePagar(organizationId, preco);
}

export async function cobrarTokensDoAstro(entrada: {
  organizationId: string;
  userId: string;
  tokensIn: number;
  tokensOut: number;
}): Promise<{ cobrado: number; parcial: boolean }> {
  const total = entrada.tokensIn + entrada.tokensOut;
  const preco = await precoDoAstro(entrada.organizationId);
  const custo = custoDeTokens(total, preco);
  if (custo <= 0) return { cobrado: 0, parcial: false };

  const resultado = await cobrarAteOSaldo({
    organizationId: entrada.organizationId,
    actionKey: ACOES.astroTokens,
    valor: custo,
    descricao: `Astro — ${total.toLocaleString("pt-BR")} tokens`,
    userId: entrada.userId,
  });

  if (resultado.parcial) {
    console.warn(
      `[astro] saldo não cobriu a resposta: pedido ${resultado.valorPedido} ★, cobrado ${resultado.valor} ★ (org ${entrada.organizationId})`,
    );
  }

  return { cobrado: resultado.valor, parcial: resultado.parcial };
}

/**
 * A busca na web, cobrada por passo que voltou com fontes.
 *
 * Cobrada no fim, junto com os tokens, e `cobrarAteOSaldo` pelo mesmo motivo:
 * a resposta já foi entregue quando a conta chega, e conta que recusa depois
 * do serviço prestado só deixaria a organização devendo.
 */
export async function cobrarBuscasNaWeb(entrada: {
  organizationId: string;
  userId: string;
  passos: number;
}): Promise<{ cobrado: number }> {
  if (entrada.passos <= 0) return { cobrado: 0 };
  const preco = await custoDaAcao(entrada.organizationId, ACOES.astroBuscaWeb);
  const custo = preco * entrada.passos;
  if (custo <= 0) return { cobrado: 0 };

  const resultado = await cobrarAteOSaldo({
    organizationId: entrada.organizationId,
    actionKey: ACOES.astroBuscaWeb,
    valor: custo,
    descricao: `Astro — ${entrada.passos} consulta${entrada.passos > 1 ? "s" : ""} na web`,
    userId: entrada.userId,
  });

  return { cobrado: resultado.valor };
}
