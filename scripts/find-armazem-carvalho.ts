import "dotenv/config";
import prisma from "@/lib/db";

async function main() {
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: "Armaz", mode: "insensitive" } },
        { name: { contains: "Carvalho", mode: "insensitive" } },
        { slug: { contains: "armazem", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });
  console.log("Matches:", orgs);
}
main().catch(e => { console.error("ERR:", e.stack || e); process.exit(1); }).finally(() => prisma.$disconnect());
