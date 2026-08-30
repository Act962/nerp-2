import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { pacotesDisponiveis } from "@/features/stars/server/pacotes";

export const listPackages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Pacotes de recarga", tags: ["Stars"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      pacotes: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          stars: z.number(),
          precoCentavos: z.number(),
        }),
      ),
    }),
  )
  .handler(async () => ({ pacotes: await pacotesDisponiveis() }));
