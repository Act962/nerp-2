import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "dev@nasaerp.com" },
  });
  await prisma.member.updateMany({
    where: { userId: user.id },
    data: { role: "owner" },
  });
  console.log("Role restaurada para owner (estado original do fixture de dev).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
