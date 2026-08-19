import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Bump obrigatório a cada migration + `pnpm db:generate`. O cache abaixo
// sobrevive ao hot-reload do dev, então sem trocar a versão o servidor
// continua usando o client ANTIGO, que não conhece os campos novos — e o
// `select` deles falha em runtime com o schema já migrado.
const SCHEMA_VERSION = "v62-space-contract";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  prismaSchemaVersion: string;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const isCacheStale = globalForPrisma.prismaSchemaVersion !== SCHEMA_VERSION;

const prisma =
  !isCacheStale && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION;
}

export default prisma;
