import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  desktopReleaseSchema,
  getLatestDesktopRelease,
} from "@/lib/desktop-release";
import { z } from "zod";

/**
 * Último release publicado do app desktop.
 *
 * Sem `requireOrgMiddleware` de propósito: o instalador é o mesmo binário para
 * toda organização, não há dado de inquilino aqui. Basta estar autenticado.
 */
export const latestDesktopRelease = base
  .use(requireAuthMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      status: z.enum(["ok", "unconfigured", "unavailable"]),
      release: desktopReleaseSchema.nullable(),
      reason: z.string().nullable(),
    }),
  )
  .handler(async () => {
    const result = await getLatestDesktopRelease();
    return {
      status: result.status,
      release: result.status === "ok" ? result.release : null,
      reason: result.status === "unavailable" ? result.reason : null,
    };
  });
