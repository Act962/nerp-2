/**
 * Catálogo de planos da organização — a fonte única de "o que cada plano
 * inclui" para Stars e limites de cadastro.
 *
 * É hard-coded de propósito: mudar preço, limite ou nome é editar este arquivo,
 * sem migration e sem tela. Os nomes e preços dos planos pagos ainda não foram
 * definidos — os três slots abaixo existem para receber isso depois, sem mexer
 * na estrutura.
 *
 * A forma segue o que o plugin `@better-auth/stripe` espera em
 * `subscription.plans` (`name`, `priceId`, `annualDiscountPriceId`, `limits`),
 * porque é ele que vai vender a assinatura, por organização (`referenceId`).
 * `planosParaBetterAuth()` é a ponte: quando o plugin entrar, o catálogo é
 * passado direto, sem duplicar a lista.
 *
 * Não confundir com `plans.ts` (Bronze/Prata/Ouro): aquele decide quais
 * MÓDULOS de trade a organização vê; este decide quantas ★ e quantos cadastros
 * ela tem. São perguntas diferentes e, por enquanto, sistemas diferentes.
 */

export type RecursoLimitado =
  | "produtos"
  | "clientes"
  | "fornecedores"
  | "lojas"
  | "membros";

export const RECURSOS_LIMITADOS: RecursoLimitado[] = [
  "produtos",
  "clientes",
  "fornecedores",
  "lojas",
  "membros",
];

export const ROTULO_DO_RECURSO: Record<
  RecursoLimitado,
  { singular: string; plural: string }
> = {
  produtos: { singular: "produto", plural: "produtos" },
  clientes: { singular: "cliente", plural: "clientes" },
  fornecedores: { singular: "fornecedor", plural: "fornecedores" },
  lojas: { singular: "loja", plural: "lojas" },
  membros: { singular: "membro", plural: "membros" },
};

/** `null` = ilimitado. Diferente das cotas de trade, onde `0` é "não incluído". */
export type LimitesDoPlano = Record<RecursoLimitado, number | null> & {
  /** ★ creditadas a cada ciclo mensal. Zero = o plano não credita nada. */
  starsPorCiclo: number;
};

export interface PlanoDef {
  /** Chave estável: é o `name` do plugin e o valor gravado em `subscription.plan`. */
  id: string;
  /** Rótulo na tela. */
  nome: string;
  descricao: string;
  /** `null` = preço ainda não definido; a tela mostra "em breve". */
  precoCentavos: number | null;
  /** Price mensal no Stripe. `null` enquanto o plano não existe lá. */
  priceId: string | null;
  /** Price anual com desconto, quando houver. */
  annualDiscountPriceId: string | null;
  gratuito: boolean;
  /** ★ dadas uma única vez, na criação da organização. */
  starsBoasVindas: number;
  limites: LimitesDoPlano;
}

export const PLANO_GRATIS: PlanoDef = {
  id: "gratis",
  nome: "Grátis",
  descricao: "Para conhecer o sistema com a sua própria operação.",
  precoCentavos: 0,
  priceId: null,
  annualDiscountPriceId: null,
  gratuito: true,
  starsBoasVindas: 50,
  limites: {
    produtos: 10,
    clientes: 10,
    fornecedores: 5,
    lojas: 1,
    membros: 2,
    starsPorCiclo: 0,
  },
};

const SEM_LIMITES: LimitesDoPlano = {
  produtos: null,
  clientes: null,
  fornecedores: null,
  lojas: null,
  membros: null,
  starsPorCiclo: 0,
};

/**
 * Slots dos planos pagos. Nome, descrição, preço, `priceId` e limites ainda
 * serão definidos — preencher aqui e nada mais precisa mudar. Enquanto o
 * `priceId` for `null` o plano aparece como "em breve" e não vai para o
 * plugin.
 */
function slotDePlanoPago(numero: number): PlanoDef {
  return {
    id: `plano-${numero}`,
    nome: `Plano ${numero}`,
    descricao: "Em definição.",
    precoCentavos: null,
    priceId: null,
    annualDiscountPriceId: null,
    gratuito: false,
    starsBoasVindas: 0,
    limites: { ...SEM_LIMITES },
  };
}

export const PLANOS: PlanoDef[] = [
  PLANO_GRATIS,
  slotDePlanoPago(1),
  slotDePlanoPago(2),
  slotDePlanoPago(3),
];

/**
 * Organizações anteriores aos limites. Não aparece na lista e não pode ser
 * escolhido: existe para quem já usava o sistema antes de existir plano
 * Grátis não acordar com limite de 10 produtos.
 */
export const PLANO_LEGADO: PlanoDef = {
  id: "legado",
  nome: "Cortesia",
  descricao: "Organização anterior aos planos: sem limites de cadastro.",
  precoCentavos: null,
  priceId: null,
  annualDiscountPriceId: null,
  gratuito: true,
  starsBoasVindas: 0,
  limites: { ...SEM_LIMITES },
};

export function planoPorId(id: string): PlanoDef | null {
  if (id === PLANO_LEGADO.id) return PLANO_LEGADO;
  return PLANOS.find((plano) => plano.id === id) ?? null;
}

export function limiteDoRecurso(
  plano: PlanoDef,
  recurso: RecursoLimitado,
): number | null {
  return plano.limites[recurso];
}

/**
 * Teto de ★ que a barra de uso mede. No plano com crédito mensal é o crédito;
 * no Grátis, que dá ★ uma vez só, é o bônus de boas-vindas. Zero quando o
 * plano não dá ★ nenhuma (legado): aí só o saldo comprado conta.
 */
export function limiteDeStars(plano: PlanoDef): number {
  return plano.limites.starsPorCiclo > 0
    ? plano.limites.starsPorCiclo
    : plano.starsBoasVindas;
}

export function formatarPrecoDoPlano(precoCentavos: number | null): string {
  if (precoCentavos === null) return "Em breve";
  if (precoCentavos === 0) return "Grátis";
  return (precoCentavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * O catálogo no formato de `subscription.plans` do `@better-auth/stripe`.
 * Só entra o que já tem `priceId`: plano sem preço no Stripe não pode ser
 * assinado, e passá-lo ao plugin só geraria um checkout que falha.
 */
export function planosParaBetterAuth(): {
  name: string;
  priceId: string;
  annualDiscountPriceId?: string;
  limits: Record<string, number>;
}[] {
  return PLANOS.filter(
    (plano): plano is PlanoDef & { priceId: string } => plano.priceId !== null,
  ).map((plano) => ({
    name: plano.id,
    priceId: plano.priceId,
    ...(plano.annualDiscountPriceId
      ? { annualDiscountPriceId: plano.annualDiscountPriceId }
      : {}),
    // O plugin só aceita número; ilimitado vira 0 e é lido daqui, não de lá.
    limits: Object.fromEntries(
      Object.entries(plano.limites).map(([chave, valor]) => [
        chave,
        valor ?? 0,
      ]),
    ),
  }));
}
