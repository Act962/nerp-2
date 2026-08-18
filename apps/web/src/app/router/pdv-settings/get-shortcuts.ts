import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Overrides de atalho do PDV da org (ou null = usa os padrões). Qualquer membro
// lê — o operador precisa saber as teclas.
export const getPdvShortcuts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(z.object({ bindings: z.record(z.string(), z.string()).nullable() }))
  .handler(async ({ context }) => {
    const org = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { pdvShortcuts: true },
    });
    const raw = org?.pdvShortcuts;
    const bindings =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (Object.fromEntries(
            Object.entries(raw as Record<string, unknown>).filter(
              ([, value]) => typeof value === "string",
            ),
          ) as Record<string, string>)
        : null;
    return { bindings };
  });
