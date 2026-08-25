import prisma from "@/lib/db";

type TargetErrors = {
  BAD_REQUEST: (options: { message: string }) => Error;
};

/**
 * Confere que TODA loja e indústria recebidas pertencem à organização antes de
 * gravar os vínculos. Um id forjado no payload viraria evento apontando para
 * loja de outro tenant — e a partir daí a audiência do outro tenant o
 * enxergaria.
 */
export async function assertTargetsInOrg(
  organizationId: string,
  storeIds: string[],
  supplierIds: string[],
  memberIds: string[],
  errors: TargetErrors,
) {
  const [stores, suppliers, members] = await Promise.all([
    storeIds.length > 0
      ? prisma.store.findMany({
          where: { organizationId, id: { in: storeIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    supplierIds.length > 0
      ? prisma.supplier.findMany({
          where: { organizationId, id: { in: supplierIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    memberIds.length > 0
      ? prisma.member.findMany({
          where: { organizationId, id: { in: memberIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  // Compara contra o conjunto: ids repetidos no payload passariam por uma
  // comparação de tamanho ingênua.
  const uniqueStores = new Set(storeIds);
  const uniqueSuppliers = new Set(supplierIds);
  const uniqueMembers = new Set(memberIds);

  if (stores.length !== uniqueStores.size) {
    throw errors.BAD_REQUEST({
      message: "Uma das lojas selecionadas não pertence a esta organização",
    });
  }
  if (suppliers.length !== uniqueSuppliers.size) {
    throw errors.BAD_REQUEST({
      message:
        "Uma das indústrias selecionadas não pertence a esta organização",
    });
  }

  if (members.length !== uniqueMembers.size) {
    throw errors.BAD_REQUEST({
      message: "Um dos promotores selecionados não pertence a esta organização",
    });
  }

  return {
    storeIds: stores.map((store) => store.id),
    supplierIds: suppliers.map((supplier) => supplier.id),
    memberIds: members.map((member) => member.id),
  };
}
