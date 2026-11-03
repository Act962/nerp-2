import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { publicarAviso } from "@/features/forca-vendas/server/avisos";
import { z } from "zod";

// Publica um aviso para a equipe.
export const publicarAvisoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      titulo: z.string().trim().min(3, "Dê um título ao aviso").max(120),
      corpo: z.string().trim().min(1, "Escreva o aviso").max(4000),
      link: z.string().url("Link inválido").nullish(),
      prioridade: z.enum(["NORMAL", "IMPORTANTE", "URGENTE"]),
      exigeConfirmacao: z.boolean().default(false),
      publico: z.enum(["TODOS", "MEMBROS"]),
      memberIds: z.array(z.string().min(1)).max(500).default([]),
      fimEm: z.string().datetime().nullish(),
    }),
  )
  .handler(async ({ input, context }) =>
    publicarAviso({
      organizationId: context.org.id,
      autor: context.vendedor,
      ...input,
    }),
  );
