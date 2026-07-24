import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Conexão explícita: o `.env` do worktree aponta para o Postgres local e vencia
// a variável passada na linha de comando, então o seed escrevia no banco errado.
const connectionString = process.env.SEED_DATABASE_URL;
if (!connectionString) {
  throw new Error("Defina SEED_DATABASE_URL antes de rodar o seed.");
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const OWNER_EMAIL = "novodev@gmail.com";
const ORG_NAME = "Gotham";
const ORG_SLUG = "gotham";

// Resolvidos em runtime: o script roda tanto no Postgres local quanto no Neon,
// e os ids da org/usuário diferem entre os dois bancos.
let ORGANIZATION_ID = "";
let CREATED_BY_ID = "";

// Chaves R2 reais já existentes na org — reaproveitadas para as miniaturas
// renderizarem de verdade em vez de imagem quebrada.
const PHOTO_KEYS = [
  "4c50e155-e26f-4599-bb5a-0c7d0f996da1-2a1191_19694a6db7dd4b81ae6c78b243a21b18_mv2.webp",
  "49ff463c-d9b7-4e61-ac6b-c93c8b961e3b-298e88af-aeea-451f-b338-04fd43813582.jpg",
  "57452752-a72a-49c2-996a-ec1dc06b8a8c-promotor-1784839740476.jpg",
  "cc53e8bf-c652-4e72-9296-ba811d31c789-298e88af-aeea-451f-b338-04fd43813582.jpg",
  "015cfee3-54e2-43e4-b42b-c49043382329-coca-cola-em-prateleiras-34607923.webp",
  "aadb9ab6-debe-47cf-80b6-447c98c28a8a-promotor-1784843425097.jpg",
  "5100e930-3d9c-494a-85a9-e63c8fe4e0f5-promotor-1784845988605.jpg",
  "782dc67f-37fc-4d5c-bdf9-07424ec547d4-20211105_pepsico_materia_2.jpg",
];

const SUPPLIERS = [
  {
    name: "Nestlé Brasil",
    tradeName: "Nestlé",
    city: "São Paulo",
    state: "SP",
  },
  {
    name: "Unilever Brasil",
    tradeName: "Unilever",
    city: "São Paulo",
    state: "SP",
  },
  {
    name: "Coca-Cola FEMSA",
    tradeName: "Coca-Cola",
    city: "Barueri",
    state: "SP",
  },
  { name: "Ambev", tradeName: "Ambev", city: "São Paulo", state: "SP" },
  {
    name: "PepsiCo Brasil",
    tradeName: "PepsiCo",
    city: "Sorocaba",
    state: "SP",
  },
  { name: "Procter & Gamble", tradeName: "P&G", city: "Louveira", state: "SP" },
];

const STORES = [
  {
    name: "Carrefour Vila Olímpia",
    city: "São Paulo",
    state: "SP",
    managerName: "Renata Alves",
  },
  {
    name: "Pão de Açúcar Moema",
    city: "São Paulo",
    state: "SP",
    managerName: "Carlos Menezes",
  },
  {
    name: "Assaí Santo Amaro",
    city: "São Paulo",
    state: "SP",
    managerName: "Juliana Prado",
  },
  {
    name: "Extra Ibirapuera",
    city: "São Paulo",
    state: "SP",
    managerName: "Marcos Tavares",
  },
  {
    name: "Atacadão Interlagos",
    city: "São Paulo",
    state: "SP",
    managerName: "Patrícia Lima",
  },
  {
    name: "Sonda Supermercados Tatuapé",
    city: "São Paulo",
    state: "SP",
    managerName: "Eduardo Rocha",
  },
];

const PROMOTERS = [
  "Ana Souza",
  "Bruno Carvalho",
  "Camila Dias",
  "Diego Martins",
];

const CITIES = [
  { city: "São Paulo", state: "SP" },
  { city: "Guarulhos", state: "SP" },
  { city: "Campinas", state: "SP" },
  { city: "Santo André", state: "SP" },
];

type Approval = "PENDING" | "APPROVED" | "REJECTED";

const REJECTION_NOTES = [
  "Código da ação ilegível na foto",
  "Foto escura, refazer com mais luz",
  "Gôndola fora do padrão do planograma",
];

// Garante a org e o vínculo do usuário. O usuário em si já existe (criado pelo
// dev); aqui só concedemos a associação — nenhuma credencial é tocada.
async function resolveOrgAndOwner() {
  const user = await prisma.user.findFirst({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `Usuário ${OWNER_EMAIL} não existe neste banco. Crie-o pelo /cadastro antes de rodar o seed.`,
    );
  }
  CREATED_BY_ID = user.id;

  const organization =
    (await prisma.organization.findFirst({
      where: { slug: ORG_SLUG },
      select: { id: true },
    })) ??
    (await prisma.organization.create({
      data: { name: ORG_NAME, slug: ORG_SLUG },
      select: { id: true },
    }));
  ORGANIZATION_ID = organization.id;

  const member = await prisma.member.findFirst({
    where: { organizationId: ORGANIZATION_ID, userId: user.id },
    select: { role: true },
  });
  if (member) {
    console.log(`${OWNER_EMAIL} já é membro de ${ORG_NAME} (${member.role})`);
  } else {
    await prisma.member.create({
      data: {
        organizationId: ORGANIZATION_ID,
        userId: user.id,
        role: "owner",
      },
    });
    console.log(`${OWNER_EMAIL} adicionado a ${ORG_NAME} como owner`);
  }

  // Deixa a org ativa nas sessões do usuário para ele cair direto nela.
  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { activeOrganizationId: ORGANIZATION_ID },
  });
}

async function main() {
  await resolveOrgAndOwner();

  const suppliers = [];
  for (const supplier of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({
      where: { organizationId: ORGANIZATION_ID, name: supplier.name },
      select: { id: true },
    });
    if (existing) {
      suppliers.push(existing);
      continue;
    }
    suppliers.push(
      await prisma.supplier.create({
        data: { ...supplier, organizationId: ORGANIZATION_ID },
        select: { id: true },
      }),
    );
  }
  console.log(`indústrias garantidas: ${suppliers.length}`);

  const stores = [];
  for (const store of STORES) {
    const existing = await prisma.store.findFirst({
      where: { organizationId: ORGANIZATION_ID, name: store.name },
      select: { id: true },
    });
    if (existing) {
      stores.push(existing);
      continue;
    }
    stores.push(
      await prisma.store.create({
        data: { ...store, organizationId: ORGANIZATION_ID },
        select: { id: true },
      }),
    );
  }
  console.log(`lojas garantidas: ${stores.length}`);

  // 24 fotos distribuídas entre lojas/indústrias/promotores, com mistura de
  // status para as três abas da tela de aprovação terem conteúdo.
  const PHOTO_COUNT = 24;
  let created = 0;
  for (let index = 0; index < PHOTO_COUNT; index++) {
    const store = stores[index % stores.length];
    const supplier = suppliers[index % suppliers.length];
    const promoterName = PROMOTERS[index % PROMOTERS.length];
    const location = CITIES[index % CITIES.length];
    const photoKey = PHOTO_KEYS[index % PHOTO_KEYS.length];

    const approvalStatus: Approval =
      index % 3 === 0 ? "PENDING" : index % 3 === 1 ? "APPROVED" : "REJECTED";

    const capturedAt = new Date(Date.now() - index * 3 * 60 * 60 * 1000);
    const isRejected = approvalStatus === "REJECTED";
    const isReviewed = approvalStatus !== "PENDING";

    await prisma.pdvPhoto.create({
      data: {
        organizationId: ORGANIZATION_ID,
        storeId: store.id,
        supplierId: supplier.id,
        photos: [photoKey],
        code: `ACAO-${String(1000 + index)}`,
        capturedAt,
        promoterName,
        capturedCity: location.city,
        capturedState: location.state,
        capturedLatitude: -23.55 - index * 0.01,
        capturedLongitude: -46.63 - index * 0.01,
        approvalStatus,
        approvalNote: isRejected
          ? REJECTION_NOTES[index % REJECTION_NOTES.length]
          : null,
        reviewedByName: isReviewed ? "Coordenação Órbita" : null,
        reviewedAt: isReviewed ? capturedAt : null,
        createdById: CREATED_BY_ID,
      },
    });
    created++;
  }
  console.log(`fotos criadas: ${created}`);

  const counts = await prisma.pdvPhoto.groupBy({
    by: ["approvalStatus"],
    where: { organizationId: ORGANIZATION_ID, promoterName: { not: null } },
    _count: true,
  });
  console.log("total por status:", JSON.stringify(counts));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
