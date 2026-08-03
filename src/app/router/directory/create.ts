import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { normalizeDocument } from "@/lib/document";
import { z } from "zod";

// Adiciona uma empresa ao diretório global. Qualquer membro pode contribuir com
// a base compartilhada. Dedup por CNPJ: se já existe, devolve a existente.
export const createDirectoryCompany = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      type: z.enum(["SUPERMERCADO", "INDUSTRIA", "DISTRIBUIDOR"]),
      name: z.string().trim().min(2, "Informe o nome").max(160),
      tradeName: z.string().trim().max(160).optional(),
      document: z.string().trim().max(40).optional(),
      city: z.string().trim().max(120).optional(),
      state: z.string().trim().max(40).optional(),
      website: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ input }) => {
    // Normalizado ANTES da checagem: gravar com máscara é o que fazia esta
    // dedupe nunca disparar quando um lado digitou "12.345.678/0001-95" e o
    // outro digitou os mesmos catorze dígitos.
    const document = normalizeDocument(input.document) ?? undefined;

    if (document) {
      const existing = await prisma.directoryCompany.findUnique({
        where: { document },
        select: { id: true },
      });
      if (existing) return { id: existing.id, deduped: true };
    }

    const company = await prisma.directoryCompany.create({
      data: {
        type: input.type,
        name: input.name,
        tradeName: input.tradeName || undefined,
        document,
        city: input.city || undefined,
        state: input.state || undefined,
        website: input.website || undefined,
        source: "USUARIO",
      },
      select: { id: true },
    });

    return { id: company.id, deduped: false };
  });
