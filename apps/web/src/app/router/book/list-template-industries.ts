import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

// Lista as indústrias (suppliers) da org com o status de completude dos seus
// padrões de book. Uma indústria está "completa" (pronta pra gerar book)
// quando tem: capa (COVER) + pelo menos 1 padrão de foto (PHOTO) + página
// final (CLOSING). EXTRA é opcional. Alimenta a tela-lista de /padroes.
export const listTemplateIndustries = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const [suppliers, templates] = await Promise.all([
      prisma.supplier.findMany({
        where: { organizationId: context.org.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, logo: true },
      }),
      prisma.bookPageTemplate.findMany({
        where: { organizationId: context.org.id, supplierId: { not: null } },
        select: { supplierId: true, kind: true },
      }),
    ]);

    // Agrega por indústria quais tipos existem.
    const bySupplier = new Map<
      string,
      { cover: boolean; photo: number; extra: number; closing: boolean }
    >();
    for (const t of templates) {
      if (!t.supplierId) continue;
      const cur = bySupplier.get(t.supplierId) ?? {
        cover: false,
        photo: 0,
        extra: 0,
        closing: false,
      };
      if (t.kind === "COVER") cur.cover = true;
      else if (t.kind === "PHOTO") cur.photo++;
      else if (t.kind === "EXTRA") cur.extra++;
      else if (t.kind === "CLOSING") cur.closing = true;
      bySupplier.set(t.supplierId, cur);
    }

    return {
      industries: suppliers.map((s) => {
        const c = bySupplier.get(s.id) ?? {
          cover: false,
          photo: 0,
          extra: 0,
          closing: false,
        };
        const missing: string[] = [];
        if (!c.cover) missing.push("capa");
        if (c.photo === 0) missing.push("página de fotos");
        if (!c.closing) missing.push("página final");
        return {
          id: s.id,
          name: s.name,
          logo: s.logo,
          hasCover: c.cover,
          photoCount: c.photo,
          extraCount: c.extra,
          hasClosing: c.closing,
          isComplete: missing.length === 0,
          missing,
        };
      }),
    };
  });
