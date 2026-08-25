import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { entryKindSchema, periodTypeSchema } from "./_schemas";
import { resolvePeriodBounds } from "./_virtual-period";

const upsertSalesGoalEntryInputSchema = z.object({
  entryId: z.string(),
  sellerName: z.string().min(1).optional(),
  goalName: z.string().min(1).optional(),
  goalAmount: z.number().nonnegative().optional(),
  achievedAmount: z.number().nonnegative().nullable().optional(),
  entryKind: entryKindSchema.optional(),
  memberId: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  // Move a entry pra outra equipe do MESMO período (aba "Vendedores" das
  // Configurações). Trocar de período junto viraria import por fora do fluxo
  // normal — fora de escopo aqui.
  branchId: z.string().optional(),
});

// Regex casado no formato dos ids virtuais gerados por _virtual-period.ts:
// `virtual:<PERIOD_TYPE>:<CODUSUR>`. Numa org com ERP ativo, o board é montado
// da venda espelhada e as entries têm esse id sintético — não existem no banco
// até a primeira edição. Sem esse detour, digitar uma meta caía num NOT_FOUND
// silencioso e o valor sumia no `onBlur`.
const VIRTUAL_ID_REGEX = /^virtual:([A-Z_]+):(.+)$/;

function parseVirtualId(id: string) {
  const match = id.match(VIRTUAL_ID_REGEX);
  if (!match) return null;
  const [, periodType, externalCode] = match;
  const parsed = periodTypeSchema.safeParse(periodType);
  if (!parsed.success) return null;
  return { periodType: parsed.data, externalCode };
}

// Entry vinculada a um Member tem o vendido calculado das vendas, mas um
// achievedAmount informado aqui vira override manual (achievedIsManual) e
// passa a valer — útil quando parte das vendas não está no NERP. Enviar
// achievedAmount: null limpa o override e devolve a entry ao automático.
export const upsertSalesGoalEntry = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar meta/vendido/vínculo de uma entry",
    tags: ["ranking"],
  })
  .input(upsertSalesGoalEntryInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    if (input.memberId) {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!member) {
        throw errors.NOT_FOUND({
          message: "Membro não encontrado nesta organização.",
        });
      }
    }

    // Caso ERP: id virtual → materializa o trio (period, branch, entry) pelo
    // CODUSUR do ExternalSeller. `branchId` não faz sentido aqui (branches
    // virtuais também não existem), então é ignorado nesse fluxo — a equipe
    // sai do supervisor cadastrado no ERP.
    const virtual = parseVirtualId(input.entryId);
    if (virtual) {
      const seller = await prisma.externalSeller.findUnique({
        where: {
          organizationId_externalCode: {
            organizationId: context.org.id,
            externalCode: virtual.externalCode,
          },
        },
        select: {
          externalCode: true,
          name: true,
          supervisorName: true,
          isBucket: true,
        },
      });
      if (!seller) {
        throw errors.NOT_FOUND({
          message: "Vendedor não encontrado no espelho do ERP.",
        });
      }

      const { periodStart, periodEnd, label } = resolvePeriodBounds(
        virtual.periodType,
      );
      const branchName =
        seller.supervisorName?.trim() ||
        (seller.isBucket ? "Canais" : "Sem equipe");

      const materialized = await prisma.$transaction(async (tx) => {
        const period = await tx.salesGoalPeriod.upsert({
          where: {
            organizationId_periodType_periodStart: {
              organizationId: context.org.id,
              periodType: virtual.periodType,
              periodStart,
            },
          },
          create: {
            organizationId: context.org.id,
            periodType: virtual.periodType,
            periodStart,
            periodEnd,
            label,
            importedByUserId: context.user.id,
          },
          update: {},
        });

        const branch = await tx.salesGoalBranch.upsert({
          where: { periodId_name: { periodId: period.id, name: branchName } },
          create: { periodId: period.id, name: branchName },
          update: {},
        });

        return tx.salesGoalEntry.upsert({
          where: {
            branchId_externalCode: {
              branchId: branch.id,
              externalCode: seller.externalCode,
            },
          },
          create: {
            branchId: branch.id,
            externalCode: seller.externalCode,
            sellerName: input.sellerName ?? seller.name,
            goalName: input.goalName ?? seller.name,
            goalAmount: input.goalAmount ?? 0,
            achievedAmount: input.achievedAmount ?? null,
            achievedIsManual:
              input.achievedAmount !== undefined &&
              input.achievedAmount !== null,
            entryKind:
              input.entryKind ?? (seller.isBucket ? "BUCKET" : "SELLER"),
            memberId: input.memberId ?? null,
            photoUrl: input.photoUrl ?? null,
          },
          update: {
            sellerName: input.sellerName,
            goalName: input.goalName,
            goalAmount: input.goalAmount,
            achievedAmount: input.achievedAmount,
            achievedIsManual:
              input.achievedAmount !== undefined
                ? input.achievedAmount !== null
                : undefined,
            entryKind: input.entryKind,
            memberId: input.memberId,
            photoUrl: input.photoUrl,
          },
        });
      });

      return {
        id: materialized.id,
        externalCode: materialized.externalCode,
        goalName: materialized.goalName,
        sellerName: materialized.sellerName,
        entryKind: materialized.entryKind,
        goalAmount: Number(materialized.goalAmount),
        achievedAmount:
          materialized.achievedAmount !== null
            ? Number(materialized.achievedAmount)
            : null,
        achievedIsManual: materialized.achievedIsManual,
        memberId: materialized.memberId,
        photoUrl: materialized.photoUrl,
        branchId: materialized.branchId,
      };
    }

    const entry = await prisma.salesGoalEntry.findFirst({
      where: {
        id: input.entryId,
        branch: { period: { organizationId: context.org.id } },
      },
      select: {
        id: true,
        externalCode: true,
        branch: { select: { periodId: true } },
      },
    });
    if (!entry) {
      throw errors.NOT_FOUND({ message: "Meta não encontrada." });
    }

    if (input.branchId) {
      const targetBranch = await prisma.salesGoalBranch.findFirst({
        where: {
          id: input.branchId,
          periodId: entry.branch.periodId,
          period: { organizationId: context.org.id },
        },
        select: { id: true },
      });
      if (!targetBranch) {
        throw errors.NOT_FOUND({
          message: "Equipe de destino não encontrada neste período.",
        });
      }
      const codeTaken = await prisma.salesGoalEntry.findFirst({
        where: {
          branchId: input.branchId,
          externalCode: entry.externalCode,
          id: { not: entry.id },
        },
        select: { id: true },
      });
      if (codeTaken) {
        throw errors.BAD_REQUEST({
          message:
            "Já existe um vendedor com este código na equipe de destino.",
        });
      }
    }

    const updated = await prisma.salesGoalEntry.update({
      where: { id: input.entryId },
      data: {
        sellerName: input.sellerName,
        goalName: input.goalName,
        goalAmount: input.goalAmount,
        achievedAmount: input.achievedAmount,
        achievedIsManual:
          input.achievedAmount !== undefined
            ? input.achievedAmount !== null
            : undefined,
        entryKind: input.entryKind,
        memberId: input.memberId,
        photoUrl: input.photoUrl,
        branchId: input.branchId,
      },
    });

    return {
      id: updated.id,
      externalCode: updated.externalCode,
      goalName: updated.goalName,
      sellerName: updated.sellerName,
      entryKind: updated.entryKind,
      goalAmount: Number(updated.goalAmount),
      achievedAmount:
        updated.achievedAmount !== null ? Number(updated.achievedAmount) : null,
      achievedIsManual: updated.achievedIsManual,
      memberId: updated.memberId,
      photoUrl: updated.photoUrl,
      branchId: updated.branchId,
    };
  });
