import { exigirContaVerificada } from "@/lib/conta-verificada";
import { base } from "./base";

/**
 * Exige organização verificada (dono com conta de verdade). Vem DEPOIS de
 * `requireOrgMiddleware`, que é quem põe `context.org`.
 *
 * O `motivo` vai no erro para o diálogo de vínculo dizer o que a pessoa
 * estava tentando fazer ("convidar alguém", "conectar o WhatsApp").
 */
export const requireVerifiedOrgMiddleware = (motivo: string) =>
  base.middleware(async ({ context, next }) => {
    const org = (context as { org?: { id: string } }).org;
    if (!org) {
      throw new Error(
        "requireVerifiedOrgMiddleware precisa vir após requireOrgMiddleware",
      );
    }
    await exigirContaVerificada(org.id, motivo);
    return next();
  });
