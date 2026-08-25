import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { DEFAULT_DEVICE_SCOPES, DEVICE_SCOPES } from "@/lib/device-scopes";
import { generateDeviceToken, hashDeviceToken } from "@/lib/device-token";
import { z } from "zod";

// Pareamento de um terminal desktop. Roda no contexto autenticado do usuário
// (login interativo), então o device nasce amarrado à ORG ATIVA — single-tenant
// por instalação — e com escopos de PDV, nunca acesso ao router inteiro (ver
// `device-scopes.ts`). O token é devolvido UMA vez; o servidor guarda só o hash.
export const pairDevice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Informe um nome para o dispositivo"),
      platform: z.enum(["windows", "macos", "linux"]),
      // Só escopos conhecidos: string livre aqui viraria um device sem acesso
      // a nada (fail-closed) e um bug difícil de ler no terminal.
      scopes: z.array(z.enum(DEVICE_SCOPES)).default(DEFAULT_DEVICE_SCOPES),
    }),
  )
  .output(z.object({ deviceId: z.string(), token: z.string() }))
  .handler(async ({ context, input }) => {
    const token = generateDeviceToken();
    const device = await prisma.device.create({
      data: {
        organizationId: context.org.id,
        userId: context.user.id,
        name: input.name,
        platform: input.platform,
        scopes: input.scopes,
        tokenHash: hashDeviceToken(token),
      },
      select: { id: true },
    });
    return { deviceId: device.id, token };
  });
