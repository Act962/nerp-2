import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import { formatSpaceCode } from "@/features/store-map/engine/space-code";
import prisma from "@/lib/db";
import { z } from "zod";

// Gera (ou regera / define manualmente) o Digital Space ID de um elemento.
// Fica FORA do bulkUpsert de propósito: aquele roda a cada autosave e undo, e
// um SELECT max(spaceSeq) ali serializaria o salvamento e queimaria sequenciais.
export const assignSpaceCode = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      mapObjectId: z.string(),
      // Código digitado à mão. Ausente = gerar/regerar automaticamente.
      customCode: z.string().trim().min(1).optional(),
      // Regenerar sobrescreve um código já existente (ex.: setor mudou) — exige
      // confirmação explícita pra não reescrever o ID silenciosamente na
      // primeira vez que mídia/setor forem preenchidos.
      confirmRegenerate: z.boolean().optional(),
    }),
  )
  .output(z.object({ spaceCode: z.string(), spaceSeq: z.number().nullable() }))
  .handler(async ({ input, context, errors }) => {
    const object = await prisma.mapObject.findFirst({
      where: { id: input.mapObjectId, organizationId: context.org.id },
      select: {
        id: true,
        spaceCode: true,
        spaceSeq: true,
        mediaType: { select: { code: true } },
        sector: { select: { code: true } },
        floorPlan: { select: { store: { select: { code: true } } } },
      },
    });
    if (!object) {
      throw errors.NOT_FOUND({ message: "Elemento não encontrado" });
    }

    // Caminho manual: grava o código digitado, unicidade garantida pelo índice.
    if (input.customCode) {
      try {
        await prisma.mapObject.update({
          where: { id: object.id },
          data: { spaceCode: input.customCode },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw errors.BAD_REQUEST({
            message: "Este ID já existe nesta organização",
          });
        }
        throw error;
      }
      return { spaceCode: input.customCode, spaceSeq: object.spaceSeq };
    }

    const organization = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { sigla: true },
    });
    const orgSigla = organization?.sigla?.trim();
    const storeCode = object.floorPlan.store.code?.trim();
    if (!orgSigla) {
      throw errors.BAD_REQUEST({
        message:
          "Cadastre a sigla da rede em Configurações antes de gerar o ID do espaço.",
      });
    }
    if (!storeCode) {
      throw errors.BAD_REQUEST({
        message:
          "Defina o código da loja no cadastro da loja antes de gerar o ID do espaço.",
      });
    }

    // Regerar (mídia/setor mudou) reaproveita o sequencial — o "CPF" do
    // espaço não muda de número. Primeira geração pega o próximo sequencial
    // da org sob lock de aviso, evitando corrida entre criações concorrentes.
    const spaceCode = await prisma.$transaction(async (tx) => {
      let seq = object.spaceSeq;
      if (seq === null) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${context.org.id}))`;
        const max = await tx.mapObject.aggregate({
          where: { organizationId: context.org.id },
          _max: { spaceSeq: true },
        });
        seq = (max._max.spaceSeq ?? 0) + 1;
      }
      const code = formatSpaceCode({
        orgSigla,
        storeCode,
        mediaCode: object.mediaType?.code ?? null,
        seq,
        sectorCode: object.sector?.code ?? null,
      });

      // Regenerar um código já existente pra um valor diferente reescreve o
      // identificador impresso na prateleira — só com confirmação explícita.
      if (
        object.spaceCode &&
        object.spaceCode !== code &&
        !input.confirmRegenerate
      ) {
        throw errors.BAD_REQUEST({
          message:
            "O ID mudaria de acordo com a mídia/setor atuais. Confirme a regeneração.",
        });
      }

      await tx.mapObject.update({
        where: { id: object.id },
        data: { spaceCode: code, spaceSeq: seq },
      });
      return { code, seq };
    });

    return { spaceCode: spaceCode.code, spaceSeq: spaceCode.seq };
  });
