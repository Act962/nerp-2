import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { FinancialCategoryType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

// DRE (Demonstração de Resultado) por COMPETÊNCIA. Tudo em CENTAVOS (Int).
//
// Regime de competência: agrupa pelo `competenceDate`; quando ausente (campo é
// opcional), cai para `dueDate` — regra de fallback documentada na tela. Lê o
// valor cheio (`amount`), não o pago, porque o resultado é por competência e não
// por caixa. Lançamentos CANCELADOS ficam de fora.
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

interface DreNode {
  id: string;
  name: string;
  total: number;
  children: DreNode[];
}

const dreNodeSchema: z.ZodType<DreNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    total: z.number().int(),
    children: z.array(dreNodeSchema),
  }),
);

const groupSchema = z.object({
  total: z.number().int(),
  nodes: z.array(dreNodeSchema),
});

interface CategoryRow {
  id: string;
  name: string;
  type: FinancialCategoryType;
  parentId: string | null;
}

const UNCATEGORIZED_ID = "__sem-categoria__";

/**
 * Monta a árvore de um tipo (REVENUE/COST/EXPENSE): cada nó soma os lançamentos
 * lançados diretamente nele + o total dos filhos do MESMO tipo. Raiz = categoria
 * do tipo sem pai (ou cujo pai é de outro tipo).
 */
function buildTree(
  type: FinancialCategoryType,
  categories: CategoryRow[],
  amountByCategory: Map<string, number>,
  uncategorized: number,
): { total: number; nodes: DreNode[] } {
  const ofType = categories.filter((c) => c.type === type);
  const idsOfType = new Set(ofType.map((c) => c.id));
  const byId = new Map(ofType.map((c) => [c.id, c]));
  const childrenByParent = new Map<string | null, CategoryRow[]>();
  for (const c of ofType) {
    const parent = c.parentId && idsOfType.has(c.parentId) ? c.parentId : null;
    const arr = childrenByParent.get(parent) ?? [];
    arr.push(c);
    childrenByParent.set(parent, arr);
  }

  const build = (catId: string): DreNode => {
    const cat = byId.get(catId);
    const own = amountByCategory.get(catId) ?? 0;
    const children = (childrenByParent.get(catId) ?? []).map((k) =>
      build(k.id),
    );
    const childrenTotal = children.reduce((sum, n) => sum + n.total, 0);
    return {
      id: catId,
      name: cat?.name ?? "—",
      total: own + childrenTotal,
      children,
    };
  };

  const nodes = (childrenByParent.get(null) ?? []).map((r) => build(r.id));
  if (uncategorized !== 0) {
    nodes.push({
      id: UNCATEGORIZED_ID,
      name: "Sem categoria",
      total: uncategorized,
      children: [],
    });
  }
  const total = nodes.reduce((sum, n) => sum + n.total, 0);
  return { total, nodes };
}

export const getDre = p
  .input(
    z.object({
      // Datas de calendário (YYYY-MM-DD); janela por competência, inclusiva.
      from: z.string(),
      to: z.string(),
    }),
  )
  .output(
    z.object({
      from: z.string(),
      to: z.string(),
      revenue: groupSchema,
      cost: groupSchema,
      expense: groupSchema,
      grossResult: z.number().int(), // Receita − Custo
      netResult: z.number().int(), // Receita − Custo − Despesa
    }),
  )
  .handler(async ({ input, context }) => {
    const fromDate = new Date(`${input.from}T00:00:00.000Z`);
    const toDate = new Date(`${input.to}T23:59:59.999Z`);

    const [categories, entries] = await Promise.all([
      prisma.paymentCategory.findMany({
        where: { organizationId: context.org.id },
        select: { id: true, name: true, type: true, parentId: true },
      }),
      prisma.paymentEntry.findMany({
        where: {
          organizationId: context.org.id,
          status: { not: "CANCELLED" },
          OR: [
            { competenceDate: { gte: fromDate, lte: toDate } },
            { competenceDate: null, dueDate: { gte: fromDate, lte: toDate } },
          ],
        },
        select: { amount: true, categoryId: true, type: true },
      }),
    ]);

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const amountByCategory = new Map<string, number>();
    // Sem categoria (ou categoria inexistente): joga pelo tipo do lançamento —
    // a receber = receita, a pagar = despesa.
    let uncategorizedRevenue = 0;
    let uncategorizedExpense = 0;

    for (const entry of entries) {
      const cat = entry.categoryId
        ? categoryById.get(entry.categoryId)
        : undefined;
      if (cat) {
        amountByCategory.set(
          cat.id,
          (amountByCategory.get(cat.id) ?? 0) + entry.amount,
        );
      } else if (entry.type === "RECEIVABLE") {
        uncategorizedRevenue += entry.amount;
      } else {
        uncategorizedExpense += entry.amount;
      }
    }

    const revenue = buildTree(
      "REVENUE",
      categories,
      amountByCategory,
      uncategorizedRevenue,
    );
    const cost = buildTree("COST", categories, amountByCategory, 0);
    const expense = buildTree(
      "EXPENSE",
      categories,
      amountByCategory,
      uncategorizedExpense,
    );

    return {
      from: input.from,
      to: input.to,
      revenue,
      cost,
      expense,
      grossResult: revenue.total - cost.total,
      netResult: revenue.total - cost.total - expense.total,
    };
  });

// DRO (Resultado Operacional): mesma base do DRE, mas separando o que é
// operacional do não-operacional/financeiro pela flag `isOperational` da
// categoria. Sem categoria = operacional (default). Resultado líquido bate com
// o do DRE (operacional + não-operacional).
const buckets = () => ({ revenue: 0, cost: 0, expense: 0 });

export const getDro = p
  .input(z.object({ from: z.string(), to: z.string() }))
  .output(
    z.object({
      from: z.string(),
      to: z.string(),
      operational: z.object({
        revenue: z.number().int(),
        cost: z.number().int(),
        expense: z.number().int(),
        result: z.number().int(),
      }),
      nonOperational: z.object({
        revenue: z.number().int(),
        cost: z.number().int(),
        expense: z.number().int(),
        result: z.number().int(),
      }),
      netResult: z.number().int(),
    }),
  )
  .handler(async ({ input, context }) => {
    const fromDate = new Date(`${input.from}T00:00:00.000Z`);
    const toDate = new Date(`${input.to}T23:59:59.999Z`);

    const [categories, entries] = await Promise.all([
      prisma.paymentCategory.findMany({
        where: { organizationId: context.org.id },
        select: { id: true, type: true, isOperational: true },
      }),
      prisma.paymentEntry.findMany({
        where: {
          organizationId: context.org.id,
          status: { not: "CANCELLED" },
          OR: [
            { competenceDate: { gte: fromDate, lte: toDate } },
            { competenceDate: null, dueDate: { gte: fromDate, lte: toDate } },
          ],
        },
        select: { amount: true, categoryId: true, type: true },
      }),
    ]);

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const op = buckets();
    const nonOp = buckets();

    for (const entry of entries) {
      const cat = entry.categoryId
        ? categoryById.get(entry.categoryId)
        : undefined;
      if (cat) {
        const bucket = cat.isOperational ? op : nonOp;
        if (cat.type === "REVENUE") bucket.revenue += entry.amount;
        else if (cat.type === "COST") bucket.cost += entry.amount;
        else bucket.expense += entry.amount;
      } else if (entry.type === "RECEIVABLE") {
        op.revenue += entry.amount;
      } else {
        op.expense += entry.amount;
      }
    }

    const opResult = op.revenue - op.cost - op.expense;
    const nonOpResult = nonOp.revenue - nonOp.cost - nonOp.expense;

    return {
      from: input.from,
      to: input.to,
      operational: { ...op, result: opResult },
      nonOperational: { ...nonOp, result: nonOpResult },
      netResult: opResult + nonOpResult,
    };
  });
