import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { findOrbitaPushKey } from "@/features/orbita-orders/server/find-push-key";
import { z } from "zod";

/**
 * Diz se a org tem uma chave do Órbita ativa com o escopo de envio de
 * pedidos. A tela do modo ORBITA avisa quando não tem: sem ela o checkout
 * recusa o pedido.
 */
export const orbitaConnectionCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Conexão do catálogo com o Órbita",
    tags: ["settings-catalog"],
  })
  .output(z.object({ orbitaConnected: z.boolean() }))
  .handler(async ({ context }) => {
    const key = await findOrbitaPushKey(context.org.id);
    return { orbitaConnected: key !== null };
  });
