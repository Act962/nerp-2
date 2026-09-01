import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);
