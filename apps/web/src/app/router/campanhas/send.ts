import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVerifiedOrgMiddleware } from "@/app/middlewares/verified-org";
import {
  dispararCampanha,
  DisparoRecusadoError,
} from "@/features/campanhas/server/disparar";

/**
 * Dispara a campanha.
 *
 * A regra (reivindicação condicionada ao status, checagem de template, de
 * destinatários e de número conectado) mora em `features/campanhas/server/
 * disparar.ts`, porque o Astro também dispara — com aprovação na conversa — e
 * duas cópias da reivindicação seriam duas chances de enviar em dobro.
 */
export const sendCampanha = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVerifiedOrgMiddleware("disparar uma campanha"))
  .route({ method: "POST", summary: "Dispara a campanha", tags: ["Campanhas"] })
  .input(z.object({ broadcastId: z.string().min(1) }))
  .output(z.object({ disparando: z.boolean(), destinatarios: z.number() }))
  .handler(async ({ input, context, errors }) => {
    try {
      return await dispararCampanha({
        broadcastId: input.broadcastId,
        organizationId: context.org.id,
      });
    } catch (erro) {
      if (erro instanceof DisparoRecusadoError) {
        throw errors.BAD_REQUEST({ message: erro.message });
      }
      throw erro;
    }
  });
