import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * Consulta pública da tela de sucesso do modo ORBITA: devolve os links do
 * pedido quando o Órbita já respondeu. Filtra a venda pela org do
 * `subdomain`, para o id de venda de uma loja não abrir o pedido de outra.
 */
export const orbitaStatus = base
  .input(
    z.object({
      subdomain: z.string().min(1),
      saleId: z.string().min(1),
    }),
  )
  .output(
    z.object({
      portalUrl: z.string().nullable(),
      whatsappUrl: z.string().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: { subdomain: input.subdomain },
      select: { id: true },
    });
    if (!organization) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const sale = await prisma.sale.findFirst({
      where: { id: input.saleId, organizationId: organization.id },
      select: { orbitaPortalUrl: true, orbitaWhatsappUrl: true },
    });
    if (!sale) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado." });
    }

    return {
      portalUrl: sale.orbitaPortalUrl,
      whatsappUrl: sale.orbitaWhatsappUrl,
    };
  });
