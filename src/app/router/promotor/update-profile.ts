import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { z } from "zod";

// Foto de perfil (selfie) e WhatsApp do promotor. Grava no `user`, não no
// `member`: é identidade da pessoa, não papel dentro da org — o mesmo rosto
// vale no ERP inteiro.
export const updatePromotorProfile = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      // URL absoluta já resolvida no cliente. O `user.image` é lido cru como
      // `src` em vários pontos (sidebar, avatar), então guardar a chave do R2
      // aqui quebraria essas telas.
      image: z.string().url().optional(),
      whatsapp: z.string().optional(),
    }),
  )
  .output(
    z.object({ image: z.string().nullable(), whatsapp: z.string().nullable() }),
  )
  .handler(async ({ input, context, errors }) => {
    const data: { image?: string; whatsapp?: string } = {};

    if (input.image !== undefined) data.image = input.image;

    if (input.whatsapp !== undefined) {
      const normalized = normalizeWhatsapp(input.whatsapp);
      if (!normalized) {
        throw errors.BAD_REQUEST({
          message:
            "Informe um WhatsApp válido com DDD, no formato (11) 99999-9999",
        });
      }
      data.whatsapp = normalized;
    }

    if (Object.keys(data).length === 0) {
      throw errors.BAD_REQUEST({ message: "Nada para atualizar" });
    }

    const user = await prisma.user.update({
      where: { id: context.user.id },
      data,
      select: { image: true, whatsapp: true },
    });

    return { image: user.image, whatsapp: user.whatsapp };
  });
