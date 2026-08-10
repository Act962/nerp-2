import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  PDV_ACTION_IDS,
  isValidShortcutKey,
} from "@/features/pdv-shortcuts/shortcuts";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "@/lib/org-access";
import { z } from "zod";

// Só o admin da org edita os atalhos (afeta todos os operadores).
export const updatePdvShortcuts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ bindings: z.record(z.string(), z.string()) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const clean: Record<string, string> = {};
    for (const [action, key] of Object.entries(input.bindings)) {
      if (!(PDV_ACTION_IDS as string[]).includes(action)) continue;
      if (!isValidShortcutKey(key))
        throw errors.BAD_REQUEST({
          message: `Tecla inválida para "${action}": ${key}`,
        });
      clean[action] = key;
    }

    // Não deixa duas ações com a mesma tecla.
    const used = new Set<string>();
    for (const key of Object.values(clean)) {
      if (used.has(key))
        throw errors.BAD_REQUEST({ message: `Tecla repetida: ${key}` });
      used.add(key);
    }

    await prisma.organization.update({
      where: { id: context.org.id },
      data: { pdvShortcuts: clean },
    });
    return { ok: true };
  });
