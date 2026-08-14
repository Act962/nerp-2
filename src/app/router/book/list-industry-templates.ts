import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Padrões de uma indústria, agrupados por seção (capa / fotos 1-4 / extras /
// final) — alimenta a página de detalhe de /padroes/industria/[id].
export const listIndustryTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: context.org.id },
      select: { id: true, name: true, logo: true },
    });
    if (!supplier) {
      throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
    }

    const templates = await prisma.bookPageTemplate.findMany({
      where: { organizationId: context.org.id, supplierId: input.supplierId },
      orderBy: [{ kind: "asc" }, { photoSize: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        isBase: true,
        photoOrientation: true,
        photoSize: true,
        layout: true,
        background: true,
        updatedAt: true,
      },
    });

    const map = (t: (typeof templates)[number]) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      photoOrientation: t.photoOrientation,
      photoSize: t.photoSize,
      layout: t.layout,
      background: t.background,
      updatedAt: t.updatedAt.toISOString(),
    });

    const baseTemplate = templates.find((t) => t.isBase);
    const cover = templates.find((t) => t.kind === "COVER");
    const closing = templates.find((t) => t.kind === "CLOSING");
    const photos = templates.filter((t) => t.kind === "PHOTO");
    // O base é kind=EXTRA mas não é uma página extra de verdade — filtra fora.
    const extras = templates.filter((t) => t.kind === "EXTRA" && !t.isBase);

    // Seções de foto por orientação: horizontais 1..2, verticais 1..4. Cada
    // slot devolve o template ou null quando ainda não foi desenhado.
    const landscapeSlots = [1, 2].map((size) => {
      const t = photos.find(
        (p) => p.photoOrientation === "LANDSCAPE" && p.photoSize === size,
      );
      return { size, template: t ? map(t) : null };
    });
    const portraitSlots = [1, 2, 3, 4].map((size) => {
      const t = photos.find(
        (p) => p.photoOrientation === "PORTRAIT" && p.photoSize === size,
      );
      return { size, template: t ? map(t) : null };
    });

    const missing: string[] = [];
    if (!cover) missing.push("capa");
    if (photos.length === 0) missing.push("página de fotos");
    if (!closing) missing.push("página final");

    return {
      supplier: { id: supplier.id, name: supplier.name, logo: supplier.logo },
      base: baseTemplate ? map(baseTemplate) : null,
      cover: cover ? map(cover) : null,
      closing: closing ? map(closing) : null,
      landscapeSlots,
      portraitSlots,
      extras: extras.map(map),
      isComplete: missing.length === 0,
      missing,
    };
  });
