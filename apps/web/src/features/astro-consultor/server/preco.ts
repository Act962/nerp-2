import { z } from "zod";

/**
 * A faixa de preço do consultor.
 *
 * A regra que sustenta este arquivo: **o modelo nunca calcula nem escreve um
 * número**. Ele chama a ferramenta, recebe uma frase pronta ("R$ 890 a
 * R$ 1.240 por mês") e repete. Preço inventado num site institucional vira
 * promessa comercial, e nenhum ajuste de prompt garante aritmética.
 *
 * A tabela é cadastrada em `/site/precos` e mora na chave `astro-precos` de
 * `SiteSetting`. Chave separada da `site` de propósito: salvar preço não pode
 * sobrescrever contato e estatísticas. Enquanto ela não existir — que é o
 * estado de hoje, com a mensalidade ainda "a definir" na visão de produto — a
 * estimativa responde `disponivel: false` e o consultor encaminha para uma
 * pessoa.
 *
 * Valores em CENTAVOS, como em `features/billing/lib/plans.ts`. O sufixo
 * `Cents` está em todo campo porque um erro de 100× aqui é uma proposta
 * errada, não um pixel torto.
 */

export const ASTRO_PRECOS_KEY = "astro-precos";

const faixaCents = z.object({
  minCents: z.number().int().min(0).default(0),
  maxCents: z.number().int().min(0).default(0),
});

export const astroPricingSchema = z.object({
  /** Enquanto falso, o consultor não fala valor nenhum. */
  ativo: z.boolean().default(false),
  disclaimer: z
    .string()
    .default("Estimativa inicial. O valor final sai do diagnóstico."),
  portes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        /** Teto de lojas deste porte. `null` = sem teto (o último da lista). */
        lojasAte: z.number().int().min(0).nullable().default(null),
        usuariosAte: z.number().int().min(0).nullable().default(null),
        baseMinCents: z.number().int().min(0).default(0),
        baseMaxCents: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  /** Acréscimo por módulo contratado, casado pelo id do catálogo. */
  modulos: z
    .array(
      z.object({
        toolId: z.string().min(1),
        minCents: z.number().int().min(0).default(0),
        maxCents: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  /** Acréscimo por loja que passar do teto do porte. */
  porLojaAdicional: faixaCents.default({ minCents: 0, maxCents: 0 }),
  /**
   * Janela de sanidade. Nenhuma combinação sai daqui — é o que impede uma
   * tabela mal preenchida de produzir "R$ 4 a R$ 900.000". Ignorada quando
   * `maxCents` é 0.
   */
  teto: faixaCents.default({ minCents: 0, maxCents: 0 }),
  setup: faixaCents
    .extend({ texto: z.string().default("") })
    .default({ minCents: 0, maxCents: 0, texto: "" }),
});

export type AstroPricing = z.infer<typeof astroPricingSchema>;

export const ASTRO_PRICING_VAZIO: AstroPricing = astroPricingSchema.parse({});

export type EntradaEstimativa = {
  porteId?: string;
  lojas?: number;
  usuarios?: number;
  toolIds?: string[];
};

export type Estimativa =
  | { disponivel: false; motivo: "sem_tabela" | "sem_porte" }
  | {
      disponivel: true;
      /** A frase pronta. É esta string que o modelo repete, sem reescrever. */
      faixa: string;
      minCents: number;
      maxCents: number;
      porte: string;
      disclaimer: string;
      setup: string | null;
      /** Como o número foi montado — para o painel conferir, não para o site. */
      memoria: string[];
      instrucao: string;
    };

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Centavos → "R$ 1.240". Arredonda para cima, para não prometer menos.
 *
 * O espaço do `Intl` em pt-BR é não separável (U+00A0). Vira espaço comum
 * aqui: esta string entra num prompt, atravessa um stream e é comparada em
 * teste — um caractere invisível nesse caminho só dá dor de cabeça.
 */
export function formatarCents(cents: number): string {
  return MOEDA.format(Math.ceil(cents / 100)).replace(/[\u00a0\u202f]/g, " ");
}

/**
 * O porte que comporta a operação descrita.
 *
 * O id explícito ganha. Sem ele, é o primeiro porte da lista cujo teto cabe —
 * por isso a ordem dos portes na tabela importa, do menor para o maior, e é
 * assim que a tela de `/site/precos` os mantém.
 */
function resolverPorte(tabela: AstroPricing, entrada: EntradaEstimativa) {
  if (entrada.porteId) {
    const escolhido = tabela.portes.find((p) => p.id === entrada.porteId);
    if (escolhido) return escolhido;
  }

  const lojas = entrada.lojas ?? 0;
  const usuarios = entrada.usuarios ?? 0;

  return (
    tabela.portes.find(
      (porte) =>
        (porte.lojasAte === null || lojas <= porte.lojasAte) &&
        (porte.usuariosAte === null || usuarios <= porte.usuariosAte),
    ) ?? tabela.portes.at(-1)
  );
}

/**
 * A faixa para uma operação. Aritmética em TypeScript, do primeiro ao último
 * centavo — nenhuma parte deste cálculo passa pelo modelo.
 */
export function estimarFaixa(
  tabela: AstroPricing,
  entrada: EntradaEstimativa = {},
): Estimativa {
  if (!tabela.ativo || tabela.portes.length === 0) {
    return { disponivel: false, motivo: "sem_tabela" };
  }

  const porte = resolverPorte(tabela, entrada);
  if (!porte) return { disponivel: false, motivo: "sem_porte" };

  const memoria: string[] = [];
  let min = porte.baseMinCents;
  let max = porte.baseMaxCents;
  memoria.push(
    `base ${porte.label}: ${formatarCents(min)}–${formatarCents(max)}`,
  );

  const escolhidos = new Set(entrada.toolIds ?? []);
  for (const modulo of tabela.modulos) {
    if (!escolhidos.has(modulo.toolId)) continue;
    min += modulo.minCents;
    max += modulo.maxCents;
    memoria.push(
      `+ ${modulo.toolId}: ${formatarCents(modulo.minCents)}–${formatarCents(modulo.maxCents)}`,
    );
  }

  const excedente =
    porte.lojasAte === null
      ? 0
      : Math.max(0, (entrada.lojas ?? 0) - porte.lojasAte);
  if (excedente > 0) {
    min += excedente * tabela.porLojaAdicional.minCents;
    max += excedente * tabela.porLojaAdicional.maxCents;
    memoria.push(`+ ${excedente} loja(s) além do porte`);
  }

  // A janela de sanidade fecha por último, depois de tudo somado.
  if (tabela.teto.maxCents > 0) {
    const antes = `${formatarCents(min)}–${formatarCents(max)}`;
    min = Math.min(Math.max(min, tabela.teto.minCents), tabela.teto.maxCents);
    max = Math.min(Math.max(max, tabela.teto.minCents), tabela.teto.maxCents);
    if (`${formatarCents(min)}–${formatarCents(max)}` !== antes) {
      memoria.push(`teto aplicado (era ${antes})`);
    }
  }

  if (max < min) max = min;

  const faixa =
    min === max
      ? `${formatarCents(min)} por mês`
      : `${formatarCents(min)} a ${formatarCents(max)} por mês`;

  const setup =
    tabela.setup.maxCents > 0
      ? `${formatarCents(tabela.setup.minCents)} a ${formatarCents(tabela.setup.maxCents)}${
          tabela.setup.texto ? ` — ${tabela.setup.texto}` : ""
        }`
      : null;

  return {
    disponivel: true,
    faixa,
    minCents: min,
    maxCents: max,
    porte: porte.label,
    disclaimer: tabela.disclaimer,
    setup,
    memoria,
    instrucao:
      "Repita a faixa exatamente como está e diga que é estimativa, citando o disclaimer. Não arredonde, não some nada e não converta em valor por loja.",
  };
}

/**
 * Lê a tabela de um valor cru do banco. Chave ausente ou fora de formato vira
 * a tabela desligada, em vez de erro: o consultor continua de pé sem preço.
 */
export function lerTabelaDePrecos(valor: unknown): AstroPricing {
  const resultado = astroPricingSchema.safeParse(valor);
  return resultado.success ? resultado.data : ASTRO_PRICING_VAZIO;
}
