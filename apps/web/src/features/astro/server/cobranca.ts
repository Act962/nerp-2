import "server-only";

import { arredondarEstrelas } from "@/features/stars/lib/decimal";
import { custoDeTokens } from "@/features/stars/lib/uso";
import {
  type BaseDeCobranca,
  custoDaResposta,
  type ModeloDef,
} from "./modelos";
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
  /** O modelo que de fato respondeu. Sem ele, vale a regra antiga da org. */
  modelo?: ModeloDef | null;
  base?: BaseDeCobranca;
}): Promise<{ cobrado: number; parcial: boolean }> {
  const total = entrada.tokensIn + entrada.tokensOut;

  /*
    Duas formas de precificar, nesta ordem:

    1. A `StarRule` da organização, quando existe. Regra gravada manda sempre —
       é o contrato do motor de cobrança, e é como se dá desconto ou se desliga
       a cobrança de um cliente específico.
    2. O CUSTO REAL do modelo que respondeu, com a margem fixa. É o padrão, e é
       o que faz o reajuste da Google chegar ao preço sem ninguém reajustar
       nada à mão.
  */
  const regra = await precoDeRegra(entrada.organizationId);
  const custo =
    regra !== null
      ? custoDeTokens(total, regra)
      : entrada.modelo && entrada.base
        ? arredondarEstrelas(
            custoDaResposta({
              modelo: entrada.modelo,
              tokensIn: entrada.tokensIn,
              tokensOut: entrada.tokensOut,
              base: entrada.base,
            }).estrelas,
          )
        : custoDeTokens(total, await precoDoAstro(entrada.organizationId));

  if (custo <= 0) return { cobrado: 0, parcial: false };

  const resultado = await cobrarAteOSaldo({
    organizationId: entrada.organizationId,
    actionKey: ACOES.astroTokens,
    valor: custo,
    descricao: entrada.modelo
      ? `Astro — ${total.toLocaleString("pt-BR")} tokens (${entrada.modelo.nome})`
      : `Astro — ${total.toLocaleString("pt-BR")} tokens`,
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

/**
 * O preço por mil tokens que a ORGANIZAÇÃO cadastrou, ou `null` quando ela
 * não cadastrou nenhum.
 *
 * `custoDaAcao` devolve o preço padrão quando não há regra, e aqui a diferença
 * importa: "não tem regra" agora significa "cobre pelo custo real do modelo",
 * e não "cobre 1 ★ por mil tokens".
 */
async function precoDeRegra(organizationId: string): Promise<number | null> {
  const { default: prisma } = await import("@/lib/db");
  const regra = await prisma.starRule.findUnique({
    where: {
      organizationId_actionKey: {
        organizationId,
        actionKey: ACOES.astroTokens,
      },
    },
    select: { stars: true, isActive: true },
  });
  if (!regra) return null;
  if (!regra.isActive) return 0;
  const { emEstrelas } = await import("@/features/stars/lib/decimal");
  return Math.max(0, emEstrelas(regra.stars));
}
