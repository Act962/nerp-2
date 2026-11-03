import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { fonteComercialDaOrg } from "@/features/forca-vendas/server/fontes";
import { filtroDeClientes } from "@/features/forca-vendas/server/escopo-equipe";
import prisma from "@/lib/db";
import { z } from "zod";

// Títulos em aberto e vencidos de toda a carteira.
export const titulosDaCarteiraFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const fonte = await fonteComercialDaOrg(context.org.id);
    const clientes = await prisma.customer.findMany({
      where: {
        organizationId: context.org.id,
        ...filtroDeClientes(context.vendedor.escopo),
      },
      take: 2000,
      select: { id: true, name: true, tradeName: true },
    });
    const nomePorId = new Map(
      clientes.map((cliente) => [
        cliente.id,
        cliente.tradeName || cliente.name,
      ]),
    );
    const titulos = await fonte.titulosEmAberto(
      clientes.map((cliente) => cliente.id),
    );
    return titulos.map((titulo) => ({
      ...titulo,
      cliente: nomePorId.get(titulo.customerId) ?? "",
    }));
  });
