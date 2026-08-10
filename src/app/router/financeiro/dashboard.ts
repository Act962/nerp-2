import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { FinancialEntryStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

// Indicadores e fluxo de caixa. Tudo em CENTAVOS (Int).
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const OPEN: FinancialEntryStatus[] = ["PENDING", "PARTIAL"];

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const getDashboard = p
  .input(z.void())
  .output(
    z.object({
      receberPendente: z.number().int(),
      pagarPendente: z.number().int(),
      vencidoReceber: z.number().int(),
      vencidoPagar: z.number().int(),
      recebidoMes: z.number().int(),
      pagoMes: z.number().int(),
      saldoContas: z.number().int(),
      proximos7: z.object({ count: z.number().int(), valor: z.number().int() }),
      monthly: z.array(
        z.object({
          month: z.string(),
          receita: z.number().int(),
          despesa: z.number().int(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const orgId = context.org.id;
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const sixMonthsAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );

    const sumOpen = async (
      type: "RECEIVABLE" | "PAYABLE",
      extra: Record<string, unknown> = {},
    ) => {
      const agg = await prisma.paymentEntry.aggregate({
        where: { organizationId: orgId, type, status: { in: OPEN }, ...extra },
        _sum: { amount: true, paidAmount: true },
      });
      return (agg._sum?.amount ?? 0) - (agg._sum?.paidAmount ?? 0);
    };

    const [
      receberPendente,
      pagarPendente,
      vencidoReceber,
      vencidoPagar,
      accountsAgg,
      paidThisMonth,
      proximos,
      recentPaid,
    ] = await Promise.all([
      sumOpen("RECEIVABLE"),
      sumOpen("PAYABLE"),
      sumOpen("RECEIVABLE", { dueDate: { lt: now } }),
      sumOpen("PAYABLE", { dueDate: { lt: now } }),
      prisma.paymentBankAccount.aggregate({
        where: { organizationId: orgId, isActive: true },
        _sum: { balance: true },
      }),
      prisma.paymentEntry.findMany({
        where: {
          organizationId: orgId,
          status: "PAID",
          paidAt: { gte: monthStart },
        },
        select: { type: true, paidAmount: true },
      }),
      prisma.paymentEntry.findMany({
        where: {
          organizationId: orgId,
          status: { in: OPEN },
          dueDate: { gte: now, lte: in7 },
        },
        select: { amount: true, paidAmount: true },
      }),
      prisma.paymentEntry.findMany({
        where: {
          organizationId: orgId,
          status: "PAID",
          paidAt: { gte: sixMonthsAgo },
        },
        select: { type: true, paidAmount: true, paidAt: true },
      }),
    ]);

    const recebidoMes = paidThisMonth
      .filter((e) => e.type === "RECEIVABLE")
      .reduce((s, e) => s + e.paidAmount, 0);
    const pagoMes = paidThisMonth
      .filter((e) => e.type === "PAYABLE")
      .reduce((s, e) => s + e.paidAmount, 0);

    const proximos7 = {
      count: proximos.length,
      valor: proximos.reduce((s, e) => s + (e.amount - e.paidAmount), 0),
    };

    // Últimos 6 meses (receita x despesa realizadas por paidAt).
    const buckets = new Map<string, { receita: number; despesa: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      buckets.set(monthKey(d), { receita: 0, despesa: 0 });
    }
    for (const e of recentPaid) {
      if (!e.paidAt) continue;
      const b = buckets.get(monthKey(e.paidAt));
      if (!b) continue;
      if (e.type === "RECEIVABLE") b.receita += e.paidAmount;
      else b.despesa += e.paidAmount;
    }
    const monthly = [...buckets.entries()].map(([month, v]) => ({
      month,
      receita: v.receita,
      despesa: v.despesa,
    }));

    return {
      receberPendente,
      pagarPendente,
      vencidoReceber,
      vencidoPagar,
      recebidoMes,
      pagoMes,
      saldoContas: accountsAgg._sum.balance ?? 0,
      proximos7,
      monthly,
    };
  });

export const getCashflow = p
  .input(z.object({ from: z.string(), to: z.string() }))
  .output(
    z.object({
      days: z.array(
        z.object({
          date: z.string(),
          inflow: z.number().int(),
          outflow: z.number().int(),
          net: z.number().int(),
        }),
      ),
      totalInflow: z.number().int(),
      totalOutflow: z.number().int(),
      net: z.number().int(),
    }),
  )
  .handler(async ({ input, context }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    // Projeção pelo vencimento: saldo em aberto por dia (não cancelado).
    const rows = await prisma.paymentEntry.findMany({
      where: {
        organizationId: context.org.id,
        status: { not: "CANCELLED" },
        dueDate: { gte: from, lte: to },
      },
      select: { type: true, amount: true, paidAmount: true, dueDate: true },
    });

    const days = new Map<string, { inflow: number; outflow: number }>();
    let totalInflow = 0;
    let totalOutflow = 0;
    for (const e of rows) {
      const remaining = e.amount - e.paidAmount;
      if (remaining <= 0) continue;
      const key = dayKey(e.dueDate);
      const bucket = days.get(key) ?? { inflow: 0, outflow: 0 };
      if (e.type === "RECEIVABLE") {
        bucket.inflow += remaining;
        totalInflow += remaining;
      } else {
        bucket.outflow += remaining;
        totalOutflow += remaining;
      }
      days.set(key, bucket);
    }

    const sorted = [...days.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        inflow: v.inflow,
        outflow: v.outflow,
        net: v.inflow - v.outflow,
      }));

    return {
      days: sorted,
      totalInflow,
      totalOutflow,
      net: totalInflow - totalOutflow,
    };
  });
