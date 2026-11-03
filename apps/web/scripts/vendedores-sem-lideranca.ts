import "dotenv/config";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";

// Lista quem perdeu acesso quando VENDEDOR deixou de contar como liderança de
// campo (Força de Vendas, F1): vendedores sem `mapa-ver-todos` deixam de ver o
// trajeto da equipe, e sem `trade-calendario` deixam de editar o calendário.
// Só lê. Rodar: pnpm --filter @nerp/web exec tsx scripts/vendedores-sem-lideranca.ts
async function main() {
  const membros = await prisma.member.findMany({
    where: { tradeRole: "VENDEDOR" },
    select: {
      role: true,
      permissions: true,
      organization: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { organizationId: "asc" },
  });

  const afetados = membros.filter((membro) => {
    if (hasFullAccess(membro.role)) return false;
    const permissoes = membro.permissions ?? [];
    return (
      !permissoes.includes("mapa-ver-todos") ||
      !permissoes.includes("trade-calendario")
    );
  });

  console.log(`Vendedores afetados: ${afetados.length} de ${membros.length}`);
  for (const membro of afetados) {
    const permissoes = membro.permissions ?? [];
    const perdeu = [
      permissoes.includes("mapa-ver-todos") ? null : "trajeto da equipe",
      permissoes.includes("trade-calendario") ? null : "editar calendário",
    ].filter(Boolean);
    console.log(
      `- ${membro.organization.name} · ${membro.user.name} <${membro.user.email}> · perdeu: ${perdeu.join(", ")}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
