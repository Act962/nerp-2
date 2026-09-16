import {
  astroAnimacao,
  lerAnimacao,
  MOMENTOS_IDS,
  slugificarAnimacao,
} from "@nerp/site-content";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import prisma from "@/lib/db";

/**
 * As animações do mascote.
 *
 * Tabela global como as demais `site_*` — o ASTRO é um só — então aqui não há
 * `organizationId` a conferir. A guarda é `requireSiteAdminMiddleware`.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const momento = z.enum(MOMENTOS_IDS as [string, ...string[]]);

const resumo = z.object({
  id: z.string(),
  slug: z.string(),
  nome: z.string(),
  momento: z.string().nullable(),
  atualizadaEm: z.string(),
});

export const listAnimacoes = siteAdmin
  .input(z.object({}))
  .output(z.object({ animacoes: z.array(resumo) }))
  .handler(async () => {
    const linhas = await prisma.siteAstroAnimacao.findMany({
      orderBy: { atualizadaEm: "desc" },
      select: {
        id: true,
        slug: true,
        nome: true,
        momento: true,
        atualizadaEm: true,
      },
    });
    return {
      animacoes: linhas.map((l) => ({
        ...l,
        atualizadaEm: l.atualizadaEm.toISOString(),
      })),
    };
  });

export const getAnimacao = siteAdmin
  .input(z.object({ slug: z.string().min(1) }))
  .output(z.object({ animacao: astroAnimacao }))
  .handler(async ({ input, errors }) => {
    const linha = await prisma.siteAstroAnimacao.findUnique({
      where: { slug: input.slug },
      select: { cena: true },
    });
    if (!linha) throw errors.NOT_FOUND({ message: "Animação não encontrada" });

    const animacao = lerAnimacao(linha.cena);
    // Cena gravada por uma versão anterior do formato, ou editada à mão no
    // banco: falhar aqui é melhor do que devolver meia cena e o editor abrir
    // com camadas faltando sem ninguém perceber.
    if (!animacao) {
      throw errors.BAD_REQUEST({
        message: "A cena gravada está num formato que o editor não entende",
      });
    }
    return { animacao };
  });

export const saveAnimacao = siteAdmin
  .input(
    z.object({
      animacao: astroAnimacao,
      momento: momento.nullable(),
      /**
       * O slug com que a cena foi ABERTA. Existe porque o slug nasce do nome:
       * sem ele, renomear uma animação salva criaria uma segunda e deixaria a
       * antiga para trás. Ausente = cena nova.
       */
      slugAtual: z.string().optional(),
    }),
  )
  .output(
    z.object({ slug: z.string(), momentoLiberado: z.string().nullable() }),
  )
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não edita as animações" });
    }

    const slug = slugificarAnimacao(input.animacao.slug || input.animacao.nome);
    if (!slug) {
      throw errors.BAD_REQUEST({ message: "Dê um nome à animação" });
    }
    if (input.animacao.camadas.length === 0) {
      throw errors.BAD_REQUEST({ message: "A cena não tem nenhuma camada" });
    }

    const cena = {
      ...input.animacao,
      slug,
      momento: input.momento,
      atualizadaEm: new Date().toISOString(),
    };

    const momentoLiberado = await prisma.$transaction(async (tx) => {
      const atual = input.slugAtual
        ? await tx.siteAstroAnimacao.findUnique({
            where: { slug: input.slugAtual },
            select: { id: true },
          })
        : null;

      // Quem assume um momento ocupado devolve o ocupante ao rascunho, em vez
      // de esbarrar no índice único. É o comportamento que a tela espera
      // ("esta animação passa a ser a do pop-up de sucesso"), e o aviso de quem
      // perdeu o posto volta junto para não ser uma troca silenciosa.
      let liberado: string | null = null;
      if (input.momento) {
        const anterior = await tx.siteAstroAnimacao.findUnique({
          where: { momento: input.momento },
          select: { id: true, slug: true, nome: true },
        });
        if (anterior && anterior.slug !== slug && anterior.id !== atual?.id) {
          await tx.siteAstroAnimacao.update({
            where: { id: anterior.id },
            data: { momento: null },
          });
          liberado = anterior.nome;
        }
      }

      const dados = {
        slug,
        nome: cena.nome,
        momento: input.momento,
        cena,
      };

      if (atual) {
        // Renomear para um nome que já é de OUTRA animação não pode virar um
        // 500 do índice único: o editor precisa poder dizer o que houve.
        const colisao = await tx.siteAstroAnimacao.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (colisao && colisao.id !== atual.id) {
          throw errors.BAD_REQUEST({
            message: "Já existe uma animação com esse nome",
          });
        }
        await tx.siteAstroAnimacao.update({
          where: { id: atual.id },
          data: dados,
        });
      } else {
        // Cena que esta sessão não abriu não substitui nada em silêncio: o
        // `upsert` daqui gravaria por cima de um trabalho alheio só porque o
        // nome bateu, e quem salvou nem saberia que apagou algo.
        const mesmoNome = await tx.siteAstroAnimacao.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (mesmoNome) {
          throw errors.BAD_REQUEST({
            message:
              "Já existe uma animação com esse nome. Abra-a na lista para editar, ou dê outro nome a esta.",
          });
        }
        await tx.siteAstroAnimacao.create({
          data: { ...dados, criadaPor: context.siteAdmin.email },
        });
      }

      return liberado;
    });

    return { slug, momentoLiberado };
  });

export const deleteAnimacao = siteAdmin
  .input(z.object({ slug: z.string().min(1) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não exclui animação" });
    }
    await prisma.siteAstroAnimacao.deleteMany({ where: { slug: input.slug } });
    return { ok: true as const };
  });
