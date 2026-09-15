import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { jornadaPorId } from "@/features/jornadas/catalogo";
import {
  configDaJornada,
  JORNADAS_CONFIG_KEY,
  lerConfigDasJornadas,
} from "@/features/jornadas/server/config";
import prisma from "@/lib/db";

/**
 * Começa (ou recomeça) uma jornada.
 *
 * O `iniciadaEm` que sai daqui é o relógio do SERVIDOR, e é contra ele que a
 * conclusão mede o tempo mínimo. Por isso o cliente recebe o valor em vez de
 * gerar o dele.
 *
 * Jornada já concluída não reinicia o relógio: refazer para relembrar é bom, e
 * quem já foi pago não é pago de novo — então não há o que medir.
 */
export const iniciar = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Começar jornada", tags: ["Jornadas"] })
  .input(z.object({ jornadaId: z.string().min(1) }))
  .output(z.object({ iniciadaEm: z.string(), concluida: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const jornada = jornadaPorId(input.jornadaId);
    if (!jornada) {
      throw errors.NOT_FOUND({ message: "Jornada não encontrada" });
    }

    const ajustes = await prisma.siteSetting.findUnique({
      where: { key: JORNADAS_CONFIG_KEY },
    });
    const { ativa } = configDaJornada(
      lerConfigDasJornadas(ajustes?.value),
      jornada,
    );
    if (!ativa) {
      throw errors.BAD_REQUEST({ message: "Esta jornada está desativada" });
    }

    const chave = {
      organizationId_userId_jornadaId: {
        organizationId: context.org.id,
        userId: context.user.id,
        jornadaId: jornada.id,
      },
    };

    const existente = await prisma.jornadaProgresso.findUnique({
      where: chave,
      select: { iniciadaEm: true, concluidaEm: true },
    });

    if (existente?.concluidaEm) {
      return {
        iniciadaEm: existente.iniciadaEm.toISOString(),
        concluida: true,
      };
    }

    const progresso = await prisma.jornadaProgresso.upsert({
      where: chave,
      create: {
        organizationId: context.org.id,
        userId: context.user.id,
        jornadaId: jornada.id,
      },
      update: { passoAtual: 0, iniciadaEm: new Date(), apressos: 0 },
      select: { iniciadaEm: true },
    });

    return { iniciadaEm: progresso.iniciadaEm.toISOString(), concluida: false };
  });
