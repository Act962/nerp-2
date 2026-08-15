import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { PdvPhotoSource, PhotoLocationStatus } from "@/generated/prisma/enums";
import { hammingDistance } from "@/features/promotor/lib/photo-fingerprint";
import prisma from "@/lib/db";
import { z } from "zod";
import { assertSupplierInOrg } from "../pdv-photo/assert-relations";
import { refreshStorePositionFromPhotos } from "./_store-position";

// Acima deste limiar de Hamming os dHash já divergem o bastante para serem
// fotos diferentes da mesma gôndola; abaixo, é a mesma imagem reenviada.
const PERCEPTUAL_REUSE_THRESHOLD = 8;

// Captura do promotor: a foto já vem carimbada (código + nome + data + geo) e
// enviada ao R2 pelo client; aqui só criamos o PdvPhoto com os metadados.
export const capturePromotorPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string(),
      supplierId: z.string(),
      photoKey: z.string(),
      code: z.string().optional(),
      // Impressão digital invisível da imagem CRUA (não carimbada) — trava
      // anti-reuso. Opcionais para não quebrar clients antigos.
      imageHash: z.string().optional(),
      perceptualHash: z.string().optional(),
      source: z.enum(PdvPhotoSource).optional(),
      // Rascunho por padrão (fica na Galeria App); `submitNow` envia direto pra
      // fila da coordenadora no mesmo gesto ("Enviar agora").
      submitNow: z.boolean().default(false),
      capturedAt: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      capturedAccuracy: z.number().optional(),
      locationStatus: z.enum(PhotoLocationStatus).optional(),
      capturedCity: z.string().optional(),
      capturedState: z.string().optional(),
      // Endereço resolvido no reverse-geocode da captura. Serve de prova de
      // onde a foto foi tirada e alimenta o endereço da loja quando vazio.
      capturedAddress: z.string().optional(),
      capturedRoad: z.string().optional(),
      capturedHouseNumber: z.string().optional(),
      capturedSuburb: z.string().optional(),
      /** A composição no celular não conseguiu carregar o selo da indústria. */
      sealMissing: z.boolean().default(false),
    }),
  )
  .output(z.object({ id: z.string(), possibleReuse: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    // Perfil incompleto trava a captura. A tela já bloqueia antes, mas a regra
    // vive aqui: sem rosto e telefone a foto entra no book sem quem responda
    // por ela, e é isso que a obrigatoriedade existe para impedir.
    const profile = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { image: true, whatsapp: true },
    });
    if (!profile?.image || !profile?.whatsapp) {
      throw errors.FORBIDDEN({
        message:
          "Complete seu perfil (foto do rosto e WhatsApp) antes de capturar fotos",
      });
    }

    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    await assertSupplierInOrg(input.supplierId, context.org.id, errors);
    // Sem exigência de vínculo promotor↔loja/indústria: qualquer membro da org
    // (perfil completo já checado acima) registra foto de qualquer loja +
    // indústria da sua organização. O escopo continua sendo a org — a loja é
    // buscada por `organizationId` e o `assertSupplierInOrg` garante a mesma
    // coisa para a indústria; nada aqui alcança dados de outra empresa.

    // Checagem de reuso (NUNCA bloqueia — só marca pra coordenadora). Escopo
    // loja+indústria: a mesma gôndola ao longo dos meses. Match forte = mesmo
    // SHA-256 (arquivo idêntico); match fraco = dHash perto (mesma foto salva
    // de novo/recomprimida).
    let possibleReuse = false;
    let reuseOfId: string | null = null;
    if (input.imageHash || input.perceptualHash) {
      const candidates = await prisma.pdvPhoto.findMany({
        where: {
          organizationId: context.org.id,
          storeId: input.storeId,
          supplierId: input.supplierId,
          OR: [
            ...(input.imageHash ? [{ imageHash: input.imageHash }] : []),
            ...(input.perceptualHash
              ? [{ perceptualHash: { not: null } }]
              : []),
          ],
        },
        select: { id: true, imageHash: true, perceptualHash: true },
        orderBy: { capturedAt: "asc" },
        take: 500,
      });
      const match = candidates.find((c) => {
        if (input.imageHash && c.imageHash === input.imageHash) return true;
        if (
          input.perceptualHash &&
          c.perceptualHash &&
          hammingDistance(input.perceptualHash, c.perceptualHash) <=
            PERCEPTUAL_REUSE_THRESHOLD
        ) {
          return true;
        }
        return false;
      });
      if (match) {
        possibleReuse = true;
        reuseOfId = match.id;
      }
    }

    const photo = await prisma.pdvPhoto.create({
      data: {
        organizationId: context.org.id,
        storeId: input.storeId,
        supplierId: input.supplierId,
        code: input.code,
        photos: [input.photoKey],
        source: input.source ?? PdvPhotoSource.APP_CAMERA,
        imageHash: input.imageHash ?? null,
        perceptualHash: input.perceptualHash ?? null,
        possibleReuse,
        reuseOfId,
        // Rascunho na Galeria App até enviar; "Enviar agora" já submete.
        submittedAt: input.submitNow ? new Date() : null,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
        promoterName: context.user.name ?? null,
        sealMissing: input.sealMissing,
        capturedCity: input.capturedCity ?? null,
        capturedState: input.capturedState ?? null,
        capturedAddress: input.capturedAddress ?? null,
        capturedLatitude: input.latitude ?? null,
        capturedLongitude: input.longitude ?? null,
        capturedAccuracy: input.capturedAccuracy ?? null,
        // Confia no status do cliente; sem ele, infere pelo par de coordenadas.
        locationStatus:
          input.locationStatus ??
          (input.latitude !== undefined && input.longitude !== undefined
            ? PhotoLocationStatus.OK
            : PhotoLocationStatus.UNKNOWN),
        createdById: context.user.id,
      },
      select: { id: true },
    });

    // A posição da loja nasce do trabalho de campo: o promotor está na porta
    // quando fotografa. Best-effort — nunca derruba a captura.
    if (input.latitude !== undefined && input.longitude !== undefined) {
      await refreshStorePositionFromPhotos({
        organizationId: context.org.id,
        storeId: store.id,
        place: {
          road: input.capturedRoad ?? null,
          houseNumber: input.capturedHouseNumber ?? null,
          suburb: input.capturedSuburb ?? null,
          city: input.capturedCity ?? null,
          state: input.capturedState ?? null,
          label: input.capturedAddress ?? null,
        },
      });
    }

    return { id: photo.id, possibleReuse };
  });
