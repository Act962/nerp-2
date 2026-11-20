import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { encerrarAviso } from "@/features/forca-vendas/server/avisos";
import { z } from "zod";

// Tira um aviso do ar.
export const encerrarAvisoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({ avisoId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await encerrarAviso(context.org.id, input.avisoId);
    return { ok: true };
  });
