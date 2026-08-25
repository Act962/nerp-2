import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  buildBasePhotoLayout,
  buildDefaultClosingLayout,
  buildDefaultCoverLayout,
  buildDefaultPhotoPageLayout,
  DEFAULT_COVER_BACKGROUND,
  DEFAULT_COVER_NAVY_BACKGROUND,
} from "@/features/books/lib/cover-layout";
import { photoPatternLabel } from "@/features/books/server/distribute-photos";
import { z } from "zod";

// Cria um padrão novo (semeado com o default do tipo) para uma indústria e
// devolve o id — a UI redireciona pro editor /padroes/[id]. COVER e CLOSING
// são únicos por indústria. PHOTO é único por (indústria, orientação, tamanho):
// horizontal 1..2, vertical 1..4. EXTRA sempre cria um novo.
export const createIndustryTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      supplierId: z.string(),
      kind: z.enum(["COVER", "PHOTO", "EXTRA", "CLOSING"]),
      photoOrientation: z.enum(["LANDSCAPE", "PORTRAIT"]).optional(),
      photoSize: z.number().int().min(1).max(3).optional(),
      name: z.string().min(1).max(80).optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: context.org.id },
      select: { id: true, name: true },
    });
    if (!supplier) {
      throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
    }

    if (input.kind === "PHOTO") {
      if (!input.photoOrientation || !input.photoSize) {
        throw errors.BAD_REQUEST({
          message: "Informe a orientação e o tamanho da página de fotos.",
        });
      }
      const max = input.photoOrientation === "LANDSCAPE" ? 2 : 3;
      if (input.photoSize > max) {
        throw errors.BAD_REQUEST({
          message: `Página ${input.photoOrientation === "LANDSCAPE" ? "horizontal" : "vertical"} comporta no máximo ${max} fotos.`,
        });
      }
    }

    // Reaproveita capa/final já existentes em vez de duplicar.
    if (input.kind === "COVER" || input.kind === "CLOSING") {
      const existing = await prisma.bookPageTemplate.findFirst({
        where: {
          organizationId: context.org.id,
          supplierId: input.supplierId,
          kind: input.kind,
        },
        select: { id: true },
      });
      if (existing) return { id: existing.id };
    }
    if (input.kind === "PHOTO") {
      const existing = await prisma.bookPageTemplate.findFirst({
        where: {
          organizationId: context.org.id,
          supplierId: input.supplierId,
          kind: "PHOTO",
          photoOrientation: input.photoOrientation,
          photoSize: input.photoSize,
        },
        select: { id: true },
      });
      if (existing) return { id: existing.id };
    }

    // Padrão base da indústria (chrome: fundo, logos, nome da loja). PHOTO herda
    // o chrome + slots; EXTRA e a página final (CLOSING) herdam SÓ o chrome — daí
    // buscamos o base para todos menos COVER. (Antes só PHOTO buscava, então
    // extras e página final nasciam sem o padrão base.)
    const baseTemplate =
      input.kind !== "COVER"
        ? await prisma.bookPageTemplate.findFirst({
            where: {
              organizationId: context.org.id,
              supplierId: input.supplierId,
              isBase: true,
            },
            select: { layout: true, background: true },
          })
        : null;

    const seededLayout =
      input.kind === "COVER"
        ? buildDefaultCoverLayout()
        : baseTemplate
          ? buildBasePhotoLayout(
              baseTemplate.layout,
              input.photoOrientation ?? "PORTRAIT",
              input.photoSize ?? 1,
            )
          : input.kind === "CLOSING"
            ? buildDefaultClosingLayout()
            : buildDefaultPhotoPageLayout(
                input.photoOrientation ?? "PORTRAIT",
                input.photoSize ?? 1,
              );

    // EXTRA e página final (CLOSING) são só chrome (abertura/divisória/
    // encerramento): nascem sem slots de foto. Ao herdar do base, removemos os
    // slots que o buildBasePhotoLayout adicionou.
    const layout =
      input.kind === "EXTRA" || input.kind === "CLOSING"
        ? seededLayout.filter((el) => el.type !== "photoSlot")
        : seededLayout;

    const defaultName =
      input.kind === "COVER"
        ? "Capa"
        : input.kind === "CLOSING"
          ? "Página final"
          : input.kind === "EXTRA"
            ? "Página extra"
            : photoPatternLabel(
                input.photoOrientation ?? "PORTRAIT",
                input.photoSize ?? 1,
              );

    // Nome único por (org, supplier, name): se colidir, adiciona sufixo.
    let name = input.name?.trim() || defaultName;
    const clash = await prisma.bookPageTemplate.findFirst({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        name,
      },
      select: { id: true },
    });
    if (clash) name = `${name} (${Date.now().toString().slice(-4)})`;

    // A capa sai no fundo azul-marinho do modelo. Páginas de fotos, extras e a
    // página final herdam o fundo do padrão base (se houver); sem base, a final
    // cai no azul-marinho e as demais no branco.
    const background =
      input.kind === "COVER"
        ? DEFAULT_COVER_NAVY_BACKGROUND
        : (baseTemplate?.background ??
          (input.kind === "CLOSING"
            ? DEFAULT_COVER_NAVY_BACKGROUND
            : DEFAULT_COVER_BACKGROUND));

    const created = await prisma.bookPageTemplate.create({
      data: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        kind: input.kind,
        photoOrientation:
          input.kind === "PHOTO" ? input.photoOrientation : null,
        photoSize: input.kind === "PHOTO" ? input.photoSize : null,
        name,
        layout: layout as unknown as Prisma.InputJsonValue,
        background: background as unknown as Prisma.InputJsonValue,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    return { id: created.id };
  });
