import prisma from "@/lib/db";

type RelationErrors = {
  NOT_FOUND: (options: { message: string }) => Error;
  BAD_REQUEST: (options: { message: string }) => Error;
};

// As FKs de PdvPhoto chegam como string crua do cliente. Sem estas checagens,
// um id de outra organização entra no banco — o middleware de org não filtra
// sozinho, cada handler precisa validar o que grava.

export async function assertSupplierInOrg(
  supplierId: string,
  organizationId: string,
  errors: RelationErrors,
) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId },
    select: { id: true },
  });
  if (!supplier) {
    throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
  }
}

export async function assertMediaTypeInOrg(
  mediaTypeId: string,
  organizationId: string,
  errors: RelationErrors,
) {
  const mediaType = await prisma.mediaType.findFirst({
    where: { id: mediaTypeId, organizationId },
    select: { id: true },
  });
  if (!mediaType) {
    throw errors.NOT_FOUND({ message: "Tipo de mídia não encontrado" });
  }
}

// Além da org, exige que o espaço pertença à MESMA loja da foto — é o que
// impede a foto do Supermercado A aparecer no mapa do Supermercado B.
// Devolve o mediaTypeId do espaço para quem quiser herdar.
export async function assertMapObjectInStore(
  mapObjectId: string,
  storeId: string,
  organizationId: string,
  errors: RelationErrors,
) {
  const mapObject = await prisma.mapObject.findFirst({
    where: { id: mapObjectId, organizationId },
    select: {
      id: true,
      mediaTypeId: true,
      floorPlan: { select: { storeId: true } },
    },
  });
  if (!mapObject) {
    throw errors.NOT_FOUND({ message: "Espaço do mapa não encontrado" });
  }
  if (mapObject.floorPlan.storeId !== storeId) {
    throw errors.BAD_REQUEST({
      message: "O espaço selecionado pertence a outra loja",
    });
  }
  return mapObject;
}
