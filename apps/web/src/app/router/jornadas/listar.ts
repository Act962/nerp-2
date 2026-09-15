import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { JORNADAS } from "@/features/jornadas/catalogo";
import {
  configDaJornada,
  JORNADAS_CONFIG_KEY,
  lerConfigDasJornadas,
} from "@/features/jornadas/server/config";
import { minutosDaJornada } from "@/features/jornadas/lib/tempo";
import { emEstrelas } from "@/features/stars/lib/decimal";
import prisma from "@/lib/db";
import { canViewPage } from "@/lib/permissions";

/**
 * As jornadas que ESTA pessoa pode fazer nesta empresa, com o progresso dela e
 * o estado da recompensa da organização.
 *
 * Uma consulta só, porque o convite flutuante pergunta isto em toda tela: o
 * progresso de quem está logado e quem já resgatou as ★ de cada jornada.
 */
export const listar = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Jornadas guiadas", tags: ["Jornadas"] })
  .input(z.object({}))
  .output(
    z.object({
      organizationId: z.string(),
      jornadas: z.array(
        z.object({
          id: z.string(),
          modulo: z.string(),
          titulo: z.string(),
          descricao: z.string(),
          rota: z.string(),
          totalPassos: z.number(),
          minutos: z.number(),
          stars: z.number(),
          ativa: z.boolean(),
          meuProgresso: z
            .object({
              passoAtual: z.number(),
              concluidaEm: z.string().nullable(),
              apressos: z.number(),
            })
            .nullable(),
          recompensaDaOrg: z.object({
            creditada: z.boolean(),
            porNome: z.string().nullable(),
          }),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;

    const [membro, ajustes, meus, resgatadas] = await Promise.all([
      prisma.member.findFirst({
        where: { organizationId, userId: context.user.id },
        select: { role: true, permissions: true, tradeRole: true },
      }),
      prisma.siteSetting.findUnique({ where: { key: JORNADAS_CONFIG_KEY } }),
      prisma.jornadaProgresso.findMany({
        where: { organizationId, userId: context.user.id },
        select: {
          jornadaId: true,
          passoAtual: true,
          concluidaEm: true,
          apressos: true,
        },
      }),
      prisma.jornadaProgresso.findMany({
        where: { organizationId, starsCreditadas: { gt: 0 } },
        select: { jornadaId: true, user: { select: { name: true } } },
      }),
    ]);

    const config = lerConfigDasJornadas(ajustes?.value);
    const meuPorId = new Map(meus.map((p) => [p.jornadaId, p]));
    const resgatePorId = new Map(
      resgatadas.map((r) => [r.jornadaId, r.user.name]),
    );

    return {
      organizationId,
      jornadas: JORNADAS
        // A permissão também é conferida aqui, e não só na tela: oferecer a
        // jornada de uma página que a pessoa não abre seria ensinar caminho
        // fechado — e contar ao de fora o que existe do lado de dentro.
        .filter((jornada) => canViewPage(membro, jornada.modulo))
        .map((jornada) => {
          const { stars, ativa } = configDaJornada(config, jornada);
          const meu = meuPorId.get(jornada.id);
          const porNome = resgatePorId.get(jornada.id) ?? null;
          return {
            id: jornada.id,
            modulo: jornada.modulo,
            titulo: jornada.titulo,
            descricao: jornada.descricao,
            rota: jornada.rota,
            totalPassos: jornada.passos.length,
            minutos: minutosDaJornada(jornada),
            stars: emEstrelas(stars),
            ativa,
            meuProgresso: meu
              ? {
                  passoAtual: meu.passoAtual,
                  concluidaEm: meu.concluidaEm?.toISOString() ?? null,
                  apressos: meu.apressos,
                }
              : null,
            recompensaDaOrg: { creditada: porNome !== null, porNome },
          };
        }),
    };
  });
