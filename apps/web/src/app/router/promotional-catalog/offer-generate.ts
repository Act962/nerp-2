import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { inngest, offerGenerateRequested } from "@/lib/inngest/client";
import { podePagar } from "@/features/stars/server/debitar";
import { chavePertenceAOrg } from "@/features/uploads/server/posse";
import { pedidoDeOfertaSchema } from "@/features/promotional-catalog/lib/oferta-desenhada";
import {
  type EntradaDaGeracao,
  estimarGeracao,
  executarGeracao,
  falharGeracao,
  iaDisponivel,
} from "@/features/promotional-catalog/server/gerar-oferta";
import { precoDaArte } from "@/features/promotional-catalog/server/gerar-arte";
import { assertCanEditCatalog } from "./_require-edit";

// Pede uma oferta desenhada pela IA. Valida tudo o que veio do cliente contra
// a organização, confere o saldo pela estimativa, grava a linha e dispara a
// função. Sem Inngest no ar (dev sem `pnpm inngest:dev`), gera inline — como
// o Catálogo PDV faz.
export const offerGenerate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Gerar oferta com IA",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      nome: z.string().min(1, "Dê um nome à oferta").max(80),
      nivel: z.enum(["ECONOMICO", "EQUILIBRADO", "PREMIUM"]),
      estiloLivre: z.boolean(),
      salvarNivelComoPadrao: z.boolean().default(false),
      // Presente = páginas para este catálogo; ausente = catálogo novo.
      catalogId: z.string().optional(),
      pedido: pedidoDeOfertaSchema,
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await assertCanEditCatalog(context.org.id, context.user.id, errors);
    const orgId = context.org.id;

    if (!iaDisponivel(input.nivel)) {
      throw errors.BAD_REQUEST({
        message: "A IA não está configurada (falta a chave da OpenAI)",
      });
    }

    if (input.catalogId) {
      const catalogo = await prisma.promotionalCatalog.findFirst({
        where: { id: input.catalogId, organizationId: orgId },
        select: { id: true },
      });
      if (!catalogo)
        throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }

    const ids = [...new Set(input.pedido.produtoIds)];
    const daOrg = await prisma.product.count({
      where: { id: { in: ids }, organizationId: orgId },
    });
    if (daOrg !== ids.length) {
      throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    }

    // Logo por chave: só o que é desta organização — prefixo dela no R2 ou
    // referência num cadastro dela (marca, produto, etiqueta…).
    const logo = input.pedido.logo;
    if (
      logo?.tipo === "asset" &&
      !(await chavePertenceAOrg(orgId, logo.chave))
    ) {
      throw errors.BAD_REQUEST({ message: "Logo inválido" });
    }

    const estimadas =
      (await estimarGeracao(orgId, input.nivel, ids.length)) +
      (input.pedido.arteIa ? await precoDaArte(orgId, input.nivel) : 0);
    if (estimadas > 0 && !(await podePagar(orgId, estimadas))) {
      throw errors.BAD_REQUEST({
        message: `Saldo de ★ insuficiente — esta oferta custa cerca de ${estimadas} ★`,
      });
    }

    if (input.salvarNivelComoPadrao) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { aiOfferLevel: input.nivel },
      });
    }

    const entrada: EntradaDaGeracao = {
      pedido: { ...input.pedido, produtoIds: ids },
      nome: input.nome,
      estiloLivre: input.estiloLivre,
    };
    const geracao = await prisma.promotionalOfferGeneration.create({
      data: {
        organizationId: orgId,
        userId: context.user.id,
        catalogId: input.catalogId ?? null,
        nivel: input.nivel,
        input: entrada as unknown as Prisma.InputJsonValue,
        starsEstimadas: estimadas,
      },
      select: { id: true },
    });

    try {
      await inngest.send(
        offerGenerateRequested.create({ generationId: geracao.id }),
      );
    } catch (falhaNoEnvio) {
      console.error(
        `[offerGenerate] inngest.send falhou para ${geracao.id}, gerando inline:`,
        falhaNoEnvio,
      );
      try {
        await executarGeracao(geracao.id);
      } catch (falha) {
        await falharGeracao(
          geracao.id,
          falha instanceof Error ? falha.message : "Falha ao gerar",
        );
      }
    }
    return { id: geracao.id };
  });
