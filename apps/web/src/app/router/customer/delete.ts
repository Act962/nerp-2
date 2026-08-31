import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const deleteCustomer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id } = input;
    // `requireOrgMiddleware` dá o `context.org`, mas não escopa consulta
    // nenhuma: sem este filtro, qualquer usuário autenticado apagava o cliente
    // de qualquer organização passando o id.
    const customer = await prisma.customer.findFirst({
      where: {
        id,
        organizationId: context.org.id,
      },
      select: { id: true },
    });
    if (!customer) {
      throw errors.NOT_FOUND({
        message: "Cliente não encontrado",
      });
    }
    return await prisma.customer.delete({
      where: {
        id: customer.id,
      },
    });
  });
