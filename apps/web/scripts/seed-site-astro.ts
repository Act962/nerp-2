import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { ASTRO_DAS_PAGINAS, lerAstroPagina } from "@nerp/site-content";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Preenche o que o Astro fala e sabe em cada página do site.
 *
 * As falas ficam em `@nerp/site-content/astro-paginas.ts`, ao lado do resto do
 * conteúdo editorial — aqui só mora o transporte para o banco.
 *
 * **Nunca sobrescreve.** Página que já tem balão, palavra-chave ou resumo é
 * pulada: o catálogo é ponto de partida, e quem manda é o que foi escrito no
 * admin. Rodar de novo depois de uma edição não desfaz o trabalho de ninguém —
 * o mesmo contrato do `seed-site-content.ts`.
 *
 * Duas variáveis mandam nele:
 *
 * - `SEED_DATABASE_URL` (obrigatória) — o banco de destino. Sem ela o script
 *   se recusa a rodar, em vez de escrever no banco do `.env`.
 * - `SEED_ASTRO_REFRESH=1` (opcional) — reescreve TAMBÉM o que já está
 *   preenchido, voltando ao texto do catálogo. É a saída para quando o
 *   catálogo melhora e se quer o texto novo em todo lugar; por isso não é o
 *   padrão.
 *
 *   SEED_DATABASE_URL="postgres://..." \
 *     pnpm --filter @nerp/web exec tsx scripts/seed-site-astro.ts
 */

const connectionString = process.env.SEED_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Defina SEED_DATABASE_URL com o banco de destino antes de rodar o seed.",
  );
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const REFRESCAR = process.env.SEED_ASTRO_REFRESH === "1";

/** Tem alguma coisa escrita? Um `ativo: true` sozinho não conta como conteúdo. */
function jaTemConteudo(valor: unknown): boolean {
  const atual = lerAstroPagina(valor);
  return (
    atual.baloes.length > 0 ||
    atual.palavrasChave.length > 0 ||
    atual.resumo.trim().length > 0
  );
}

async function main() {
  const paginas = await prisma.sitePage.findMany({
    select: { id: true, slug: true, title: true, astro: true },
    orderBy: { slug: "asc" },
  });

  let preenchidas = 0;
  let puladas = 0;
  const semSugestao: string[] = [];

  for (const pagina of paginas) {
    const sugestao = ASTRO_DAS_PAGINAS[pagina.slug];
    if (!sugestao) {
      semSugestao.push(pagina.slug);
      continue;
    }

    if (!REFRESCAR && jaTemConteudo(pagina.astro)) {
      puladas += 1;
      continue;
    }

    await prisma.sitePage.update({
      where: { id: pagina.id },
      data: { astro: sugestao },
    });
    preenchidas += 1;
    console.log(`  preenchida  ${pagina.slug}  (${pagina.title})`);
  }

  console.log(
    `\n${preenchidas} página(s) preenchida(s), ${puladas} já tinha(m) texto.`,
  );

  // Dizer quais ficaram de fora, em vez de terminar com um "pronto" que
  // esconde a lacuna: é essa lista que diz para quais páginas ainda falta
  // escrever fala no catálogo.
  if (semSugestao.length > 0) {
    console.log(
      `\n${semSugestao.length} página(s) sem sugestão no catálogo:\n  ${semSugestao.join("\n  ")}`,
    );
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
