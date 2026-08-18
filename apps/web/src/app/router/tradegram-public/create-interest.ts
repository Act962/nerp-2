import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

// Captura de lead do TradeGram público (sem login). O visitante demonstra
// interesse num espaço; o registro fica DENTRO da plataforma para o dono da
// loja trabalhar. Não expõe nem coleta contato do comercial — a plataforma é a
// corretora. Exige ao menos um canal de retorno (e-mail ou telefone).
export const createInterest = base
  .route({
    method: "POST",
    summary: "Registrar interesse num espaço (TradeGram)",
    tags: ["tradegram-public"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      mapObjectId: z.string().optional(),
      kind: z.enum(["INTERESSE", "FILA_ESPERA"]),
      spaceCode: z.string().max(120).optional(),
      spaceLabel: z.string().max(120).optional(),
      name: z.string().trim().min(2, "Informe seu nome").max(120),
      company: z.string().trim().max(120).optional(),
      email: z
        .string()
        .trim()
        .email("E-mail inválido")
        .max(160)
        .optional()
        .or(z.literal("")),
      phone: z.string().trim().max(40).optional(),
      message: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const email = input.email?.trim() || undefined;
    const phone = input.phone?.trim() || undefined;
    if (!email && !phone) {
      throw errors.BAD_REQUEST({
        message: "Informe um e-mail ou telefone para contato",
      });
    }

    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true, isPublicProfile: true },
    });
    if (!org || !org.isPublicProfile) {
      throw errors.NOT_FOUND({ message: "Perfil não encontrado" });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: org.id },
      select: { id: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    let mapObjectId: string | undefined;
    if (input.mapObjectId) {
      const mapObject = await prisma.mapObject.findFirst({
        where: {
          id: input.mapObjectId,
          organizationId: org.id,
          floorPlan: { storeId: store.id },
        },
        select: { id: true },
      });
      mapObjectId = mapObject?.id;
    }

    await prisma.spaceInterest.create({
      data: {
        organizationId: org.id,
        storeId: store.id,
        mapObjectId,
        kind: input.kind,
        spaceCode: input.spaceCode,
        spaceLabel: input.spaceLabel,
        name: input.name,
        company: input.company || undefined,
        email,
        phone,
        message: input.message || undefined,
      },
    });

    return { ok: true };
  });
