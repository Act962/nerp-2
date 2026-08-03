import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const listMembers = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar membros da organização ativa",
    tags: ["members"],
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.string(),
        userId: z.string(),
        role: z.string(),
        permissions: z.array(z.string()),
        name: z.string(),
        email: z.string(),
        image: z.string().nullable(),
        createdAt: z.string(),
        supervisorId: z.string().nullable(),
        supervisorName: z.string().nullable(),
        tradeRole: z.string().nullable(),
        showInPromotorPhoto: z.boolean(),
        supplierIds: z.array(z.string()),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const members = await prisma.member.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true, email: true, image: true } },
        supervisor: { select: { user: { select: { name: true } } } },
        promoterSuppliers: { select: { supplierId: true } },
      },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      permissions: m.permissions ?? [],
      name: m.user.name,
      email: m.user.email,
      image: m.user.image ?? null,
      createdAt: m.createdAt.toISOString(),
      supervisorId: m.supervisorId ?? null,
      supervisorName: m.supervisor?.user.name ?? null,
      tradeRole: m.tradeRole ?? null,
      showInPromotorPhoto: m.showInPromotorPhoto,
      supplierIds: m.promoterSuppliers.map((link) => link.supplierId),
    }));
  });
