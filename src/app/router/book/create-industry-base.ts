import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  buildDefaultPhotoPageLayout,
  DEFAULT_COVER_BACKGROUND,
} from "@/features/books/lib/cover-layout";
import { z } from "zod";

// Cria (ou retorna) o PADRÃO BASE da indústria — o "chrome" (fundo, logos,
// nome da loja) que os novos padrões de foto copiam. Um por indústria. Nasce
// semeado com o cabeçalho padrão + 2 espaços de exemplo, que a coordenadora
// ajusta uma vez. Redireciona pro editor.
export const createIndustryBase = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!supplier) {
      throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
    }

    const existing = await prisma.bookPageTemplate.findFirst({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        isBase: true,
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id };

    const created = await prisma.bookPageTemplate.create({
      data: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        kind: "EXTRA",
        isBase: true,
        name: "Padrão base",
        layout: buildDefaultPhotoPageLayout(
          "PORTRAIT",
          2,
        ) as unknown as Prisma.InputJsonValue,
        background:
          DEFAULT_COVER_BACKGROUND as unknown as Prisma.InputJsonValue,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    return { id: created.id };
  });
