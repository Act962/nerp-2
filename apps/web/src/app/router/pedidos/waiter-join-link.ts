import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { signWaiterJoinToken } from "@/lib/waiter-join-token";
import z from "zod";

// Emite o slug + um token assinado de auto-join para a org ativa. O QR do app
// do garçom usa esses dados para que quem escaneia (deslogado) consiga se
// cadastrar e entrar na org. Assinatura é server-side (depende de
// SYNC_SHARED_SECRET), por isso vira endpoint em vez de montar no cliente.
export const waiterJoinLink = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Slug + token de auto-join (QR do app do garçom) da org ativa",
    tags: ["pedidos"],
  })
  .input(z.object({}))
  .output(z.object({ slug: z.string(), joinToken: z.string() }))
  .handler(async ({ context }) => {
    return {
      slug: context.org.slug,
      joinToken: signWaiterJoinToken({ orgId: context.org.id }),
    };
  });
