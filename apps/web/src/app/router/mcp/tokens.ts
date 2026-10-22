import z from "zod";
import {
  ESCOPO_IMPORTACAO,
  ESCOPO_MAPEAMENTO,
  PLATAFORMA_DO_AGENTE,
} from "@/features/mcp/escopos";
import prisma from "@/lib/db";
import { generateDeviceToken, hashDeviceToken } from "@/lib/device-token";
import { procedimento } from "../mapeamento-banco/_procedimento";

// Tokens do MCP do NERP. Mesmo portão do mapeamento do banco (equipe interna +
// admin da org), que hoje também é o da importação. Todo token mapeia; gravar
// no NERP (importar) é opcional e pode ser ligado ou desligado depois.

const tags = ["mcp"];

function escoposDoToken(importar: boolean) {
  return importar
    ? [ESCOPO_MAPEAMENTO, ESCOPO_IMPORTACAO]
    : [ESCOPO_MAPEAMENTO];
}

async function tokenDaOrg(id: string, organizationId: string) {
  // Id revalidado contra a org E a plataforma: daqui não se mexe em caixa.
  return prisma.device.findFirst({
    where: { id, organizationId, platform: PLATAFORMA_DO_AGENTE },
    select: { id: true, revokedAt: true },
  });
}

export const listarTokensDoMcp = procedimento
  .route({ summary: "Tokens de agente de IA da organização", tags })
  .input(z.object({}))
  .handler(async ({ context }) => {
    const tokens = await prisma.device.findMany({
      where: { organizationId: context.org.id, platform: PLATAFORMA_DO_AGENTE },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        userId: true,
        scopes: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    const donos = await prisma.user.findMany({
      where: { id: { in: [...new Set(tokens.map((token) => token.userId))] } },
      select: { id: true, name: true, email: true },
    });
    const donoPorId = new Map(donos.map((dono) => [dono.id, dono]));
    return {
      tokens: tokens.map((token) => ({
        id: token.id,
        nome: token.name,
        escopos: token.scopes,
        dono: donoPorId.get(token.userId)?.email ?? null,
        vistoEm: token.lastSeenAt?.toISOString() ?? null,
        revogadoEm: token.revokedAt?.toISOString() ?? null,
        criadoEm: token.createdAt.toISOString(),
      })),
    };
  });

/**
 * O token sai UMA vez, nesta resposta. No banco fica só o hash (como o dos
 * terminais do desktop): perdeu, gera outro e revoga o antigo.
 */
export const criarTokenDoMcp = procedimento
  .route({ summary: "Gerar token de agente de IA", tags })
  .input(
    z.object({
      nome: z.string().trim().min(1, "Dê um nome ao token").max(60),
      importar: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context }) => {
    const token = generateDeviceToken();
    const criado = await prisma.device.create({
      data: {
        organizationId: context.org.id,
        userId: context.user.id,
        name: input.nome,
        platform: PLATAFORMA_DO_AGENTE,
        tokenHash: hashDeviceToken(token),
        scopes: escoposDoToken(input.importar),
      },
      select: { id: true },
    });
    return { id: criado.id, token };
  });

export const revogarTokenDoMcp = procedimento
  .route({ summary: "Revogar token de agente de IA", tags })
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const token = await tokenDaOrg(input.id, context.org.id);
    if (!token) throw errors.NOT_FOUND({ message: "Token não encontrado." });
    await prisma.device.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });
    return { id: token.id };
  });

/** Liga ou desliga a importação de um token que já está em uso. */
export const alterarImportacaoDoToken = procedimento
  .route({ summary: "Permitir ou não que o agente importe dados", tags })
  .input(z.object({ id: z.string().min(1), importar: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const token = await tokenDaOrg(input.id, context.org.id);
    if (!token) throw errors.NOT_FOUND({ message: "Token não encontrado." });
    if (token.revokedAt) {
      throw errors.BAD_REQUEST({ message: "Este token já foi revogado." });
    }
    await prisma.device.update({
      where: { id: token.id },
      data: { scopes: escoposDoToken(input.importar) },
    });
    return { id: token.id, importar: input.importar };
  });
