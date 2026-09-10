/**
 * A conta do uso de ★ — pura, sem `server-only`, porque o painel da sidebar
 * e o servidor precisam chegar ao mesmo número pelo mesmo caminho.
 *
 * `limite` é o que o plano deu (crédito do ciclo ou bônus de boas-vindas);
 * `consumido` é o que foi debitado desde o início do ciclo; `saldo` é o que
 * ainda há na conta, incluindo ★ compradas avulsas.
 */

export type NivelDeUso = "ok" | "atencao" | "critico" | "esgotado";

export interface EntradaDeUso {
  saldo: number;
  limite: number;
  consumido: number;
}

export interface UsoDeStars extends EntradaDeUso {
  /** 0–100, quanto do plano já foi consumido. Zero quando o plano não dá ★. */
  percentual: number;
  /** O que passou do plano — pago com ★ avulsas. */
  usoExtra: number;
  /** O que ainda sobra do plano neste ciclo. */
  restanteDoPlano: number;
  nivel: NivelDeUso;
}

const LIMIAR_CRITICO = 0.1;
const LIMIAR_ATENCAO = 0.3;

/**
 * O nível sai do SALDO em relação ao limite, não do percentual consumido.
 * Dá no mesmo enquanto só há ★ do plano; a diferença aparece quando a
 * organização compra avulsas: quem tem 450 ★ no bolso não fica vermelho só
 * porque gastou as 50 do plano.
 */
export function calcularUso(entrada: EntradaDeUso): UsoDeStars {
  const limite = Math.max(0, entrada.limite);
  const consumido = Math.max(0, entrada.consumido);
  const saldo = Math.max(0, entrada.saldo);

  const percentual =
    limite > 0 ? Math.min(100, Math.round((consumido / limite) * 100)) : 0;
  const usoExtra = Math.max(0, consumido - limite);
  const restanteDoPlano = Math.max(0, limite - consumido);

  return {
    saldo,
    limite,
    consumido,
    percentual,
    usoExtra,
    restanteDoPlano,
    nivel: nivelDoSaldo(saldo, limite),
  };
}

function nivelDoSaldo(saldo: number, limite: number): NivelDeUso {
  if (saldo <= 0) return "esgotado";
  // Sem limite (plano que não dá ★), o saldo é só o comprado: qualquer
  // quantidade positiva está "ok" — não há referência para dizer que é pouco.
  if (limite <= 0) return "ok";
  const restante = saldo / limite;
  if (restante <= LIMIAR_CRITICO) return "critico";
  if (restante <= LIMIAR_ATENCAO) return "atencao";
  return "ok";
}

/**
 * Quanto custa uma conversa: ★ por bloco de 1.000 tokens, arredondando para
 * cima — o bloco começado é cobrado inteiro, como minuto de ligação.
 */
export function custoDeTokens(totalTokens: number, precoPor1k: number): number {
  if (totalTokens <= 0 || precoPor1k <= 0) return 0;
  return Math.ceil(totalTokens / 1000) * precoPor1k;
}
