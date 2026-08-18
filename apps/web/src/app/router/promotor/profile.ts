import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { tradeRoleLabel } from "@/lib/permissions";
import { z } from "zod";

// Perfil que o app do promotor precisa para se montar: a identificação dele
// (foto + WhatsApp) e a marca da org, exibidas no cabeçalho. `isComplete` é a
// mesma regra que o `capture` aplica no servidor — a tela só antecipa o bloqueio.
export const getPromotorProfile = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      name: z.string(),
      image: z.string().nullable(),
      whatsapp: z.string().nullable(),
      isComplete: z.boolean(),
      orgName: z.string(),
      orgLogo: z.string().nullable(),
      // Coordenação/supervisão marcada para sair carimbada na foto.
      photoCredits: z.array(z.object({ name: z.string(), role: z.string() })),
    }),
  )
  .handler(async ({ context }) => {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { name: true, image: true, whatsapp: true },
    });

    // Só entra no carimbo quem tem cargo no Trade definido (Coordenador,
    // Supervisor, etc.). Membro marcado sem cargo caía na tarja genérica
    // "Equipe: <nome>", que não agrega e foi removida a pedido do campo.
    const credits = await prisma.member.findMany({
      where: {
        organizationId: context.org.id,
        showInPromotorPhoto: true,
        tradeRole: { not: null },
      },
      orderBy: { createdAt: "asc" },
      // Duas linhas bastam: cada uma vira uma tarja no rodapé e a foto é da
      // gôndola, não do organograma.
      take: 2,
      select: { tradeRole: true, user: { select: { name: true } } },
    });

    const organization = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { name: true, logo: true },
    });

    return {
      name: user?.name ?? "Promotor",
      image: user?.image ?? null,
      whatsapp: user?.whatsapp ?? null,
      isComplete: Boolean(user?.image && user?.whatsapp),
      orgName: organization?.name ?? "",
      orgLogo: organization?.logo ?? null,
      photoCredits: credits.flatMap((member) => {
        const role = tradeRoleLabel(member.tradeRole);
        return role ? [{ name: member.user.name, role }] : [];
      }),
    };
  });
