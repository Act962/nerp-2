import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { generateFloorPlanPdf } from "@/features/store-map/server/generate-floor-plan-pdf";
import prisma from "@/lib/db";
import { z } from "zod";

// Gera o PDF vetorial da planta inline (rápido: 1 imagem + N vetores) e devolve
// a key do R2. Sem worker/Inngest — diferente do Book, que baixa dezenas de fotos.
export const exportFloorPlanPdf = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ floorPlanId: z.string() }))
  .output(z.object({ key: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id: input.floorPlanId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!floorPlan) {
      throw errors.NOT_FOUND({ message: "Mapa não encontrado" });
    }

    const key = await generateFloorPlanPdf(input.floorPlanId, context.org.id);
    return { key };
  });
