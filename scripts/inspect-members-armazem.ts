import "dotenv/config";
import prisma from "@/lib/db";

const ORG_ID = "cmrytf67d0000s7xbg2l9363d";
async function main() {
  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true, name: true, slug: true },
  });
  console.log("Org:", org);
  const members = await prisma.member.findMany({
    where: { organizationId: ORG_ID },
    select: {
      id: true,
      role: true,
      tradeRole: true,
      permissions: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nTotal membros: ${members.length}`);
  const byRole: Record<string, number> = {};
  const byTradeRole: Record<string, number> = {};
  const hasVendedorPerm: number[] = [];
  for (const m of members) {
    byRole[m.role ?? "null"] = (byRole[m.role ?? "null"] ?? 0) + 1;
    byTradeRole[m.tradeRole ?? "null"] = (byTradeRole[m.tradeRole ?? "null"] ?? 0) + 1;
    if (m.permissions?.includes("vendedor")) hasVendedorPerm.push(1);
  }
  console.log("Por role:", byRole);
  console.log("Por tradeRole atual:", byTradeRole);
  console.log("Com permission 'vendedor':", hasVendedorPerm.length);
  console.log("\nListagem (top 20):");
  for (const m of members.slice(0, 20)) {
    console.log(
      `  ${(m.user?.name ?? "?").padEnd(30)} ${(m.user?.email ?? "").padEnd(40)} role=${m.role ?? "-"} tradeRole=${m.tradeRole ?? "-"}`,
    );
  }
  if (members.length > 20) console.log(`  … +${members.length - 20} outros`);
}
main().catch(e => { console.error("ERR:", e.stack || e); process.exit(1); }).finally(() => prisma.$disconnect());
