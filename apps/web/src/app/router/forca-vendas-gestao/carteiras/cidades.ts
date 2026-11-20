import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { cidadesDosClientes } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Cidades dos clientes, para atribuir carteira por região.
export const cidadesGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => cidadesDosClientes(context.org.id));
