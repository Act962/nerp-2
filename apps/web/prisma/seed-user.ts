import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

// ID da organização EXISTENTE que o usuário vai entrar

export async function main() {
  const EXISTING_ORGANIZATION_ID = "0w9GLWT8zvzzVajkIyeByhPoqQSusHtI";
  console.log("🌱 Iniciando seed...");

  // 1. Criar o novo usuário
  const newUser = await prisma.user.create({
    data: {
      name: "João Silva",
      email: "joao.silva@example.com",
      emailVerified: true,
      image: "https://avatar.vercel.sh/joao",
    },
  });
  console.log(`✅ Usuário criado: ${newUser.name} (${newUser.id})`);

  // 2. Criar uma conta de autenticação para o usuário (com senha)
  const userAccount = await prisma.account.create({
    data: {
      userId: newUser.id,
      accountId: newUser.id,
      providerId: "credential",
      // Senha hasheada para "senha123" (você deve usar bcrypt na prática)
      password: "$2a$10$YourHashedPasswordHere",
    },
  });
  console.log(`✅ Conta de autenticação criada para ${newUser.email}`);

  // 3. Criar uma sessão para o usuário
  const userSession = await prisma.session.create({
    data: {
      userId: newUser.id,
      token: `session_${Date.now()}_${Math.random().toString(36)}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      activeOrganizationId: EXISTING_ORGANIZATION_ID,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
    },
  });
  console.log(`✅ Sessão criada: ${userSession.token}`);

  const membership = await prisma.member.create({
    data: {
      userId: newUser.id,
      organizationId: EXISTING_ORGANIZATION_ID,
      role: "member", // Pode ser "admin", "member", "viewer", etc.
    },
  });

  const organization = await prisma.organization.findUnique({
    where: { id: EXISTING_ORGANIZATION_ID },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (organization) {
    console.log(`\n📊 Organização: ${organization.name}`);
    console.log(`👥 Total de membros: ${organization.members.length}`);
    console.log("\nMembros:");
    organization.members.forEach((member) => {
      console.log(`  - ${member.user.name} (${member.role})`);
    });
  } else {
    console.error(`❌ Organização ${EXISTING_ORGANIZATION_ID} não encontrada!`);
  }

  console.log("\n✨ Seed concluído com sucesso!");
}

main();
