import { base } from "@/app/middlewares/base";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { generateDeviceToken, hashDeviceToken } from "@/lib/device-token";
import { z } from "zod";

/**
 * Pareamento por credenciais — o "login" do app desktop.
 *
 * É um procedure `base` (sem middleware de auth): ELE é a autenticação. Verifica
 * e-mail/senha pelo próprio Better Auth (`signInEmail`) e devolve um token de
 * device NO CORPO. Nada de cookie — assim funciona cross-origin pelo `/api/rpc`
 * (que já tem CORS), sem o inferno de cookie cross-subdomínio.
 *
 * O device nasce amarrado a UMA org (single-tenant por instalação): a informada
 * em `organizationId` (revalidada contra as do usuário) ou a primeira do usuário.
 */
export const pairDeviceWithCredentials = base
  .input(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
      name: z.string().min(1, "Informe um nome para o dispositivo"),
      platform: z.enum(["windows", "macos", "linux"]),
      organizationId: z.string().optional(),
    }),
  )
  .output(
    z.object({
      deviceId: z.string(),
      token: z.string(),
      organizationId: z.string(),
      organizationName: z.string(),
      // Nome do usuário pareado = operador do caixa (identidade plugável).
      operatorName: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    // 1) Verifica a senha pelo Better Auth. Lança em credencial inválida.
    let userId: string;
    let operatorName: string;
    try {
      const result = await auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        headers: new Headers(),
      });
      userId = result.user.id;
      operatorName = result.user.name;
    } catch {
      throw errors.UNAUTHORIZED({ message: "E-mail ou senha inválidos" });
    }

    // 2) Resolve a org: a informada (revalidada) ou a primeira do usuário.
    const memberships = await prisma.member.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    if (memberships.length === 0) {
      throw errors.FORBIDDEN({
        message: "Este usuário não pertence a nenhuma organização",
      });
    }

    const orgIds = new Set(memberships.map((m) => m.organizationId));
    const organizationId =
      input.organizationId ?? memberships[0].organizationId;
    if (!orgIds.has(organizationId)) {
      throw errors.FORBIDDEN({
        message: "Você não pertence à organização informada",
      });
    }

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    // 3) Cria o device e devolve o token (guardamos só o hash).
    const token = generateDeviceToken();
    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        userId,
        name: input.name,
        platform: input.platform,
        scopes: [],
        tokenHash: hashDeviceToken(token),
      },
      select: { id: true },
    });

    return {
      deviceId: device.id,
      token,
      organizationId: org.id,
      organizationName: org.name,
      operatorName,
    };
  });
