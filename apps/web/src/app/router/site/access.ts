import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import prisma from "@/lib/db";
import { SITE_SUPER_ADMIN_EMAIL } from "@/lib/site-admin";

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const role = z.enum(["SUPER_ADMIN", "EDITOR", "REDATOR"]);

export const listAccess = siteAdmin
  .input(z.object({}))
  .output(
    z.object({
      superAdminEmail: z.string(),
      admins: z.array(
        z.object({
          id: z.string(),
          email: z.string(),
          name: z.string().nullable(),
          role,
          hasAccount: z.boolean(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const rows = await prisma.siteAdmin.findMany({
      orderBy: { createdAt: "asc" },
    });
    return {
      superAdminEmail: SITE_SUPER_ADMIN_EMAIL,
      admins: rows.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        role: a.role,
        hasAccount: Boolean(a.userId),
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

export const inviteAccess = siteAdmin
  .input(
    z.object({
      email: z.string().email("E-mail inválido"),
      name: z.string().default(""),
      role: z.enum(["EDITOR", "REDATOR"]).default("EDITOR"),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({ message: "Só o super admin dá acesso" });
    }

    const email = input.email.toLowerCase();
    if (email === SITE_SUPER_ADMIN_EMAIL) {
      throw errors.BAD_REQUEST({
        message: "Este e-mail já é o super admin do site",
      });
    }

    const admin = await prisma.siteAdmin.upsert({
      where: { email },
      create: {
        email,
        name: input.name || null,
        role: input.role,
        invitedBy: context.siteAdmin.email,
      },
      update: { role: input.role, name: input.name || undefined },
      select: { id: true },
    });
    return { id: admin.id };
  });

export const removeAccess = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({ message: "Só o super admin tira acesso" });
    }
    const admin = await prisma.siteAdmin.findUnique({
      where: { id: input.id },
      select: { email: true },
    });
    // O super admin não sai da lista nem por acidente: sem esta guarda, uma
    // linha com o e-mail dele apagada deixaria o site sem dono.
    if (admin?.email === SITE_SUPER_ADMIN_EMAIL) {
      throw errors.FORBIDDEN({
        message: "O super admin não pode ser removido",
      });
    }
    await prisma.siteAdmin.deleteMany({ where: { id: input.id } });
    return { ok: true as const };
  });
