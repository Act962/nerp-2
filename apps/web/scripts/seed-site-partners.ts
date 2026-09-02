import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { BRANDS_SAMPLE, PARTNERS_SAMPLE } from "@nerp/site-content";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Enche as duas listas de parceiros com conteúdo de MENTIRA, para desenvolver.
 *
 * ⚠️ Nada aqui é real: nomes inventados, logotipos e fotos desenhados em SVG.
 * É o mesmo conjunto que o `apps/site` mostra em `?parceiros=demo`, então o
 * que se vê no site com o seed aplicado é o que se vê sem ele — a diferença é
 * que aqui o caminho inteiro é exercitado: banco → API → site.
 *
 * O conteúdo de verdade NUNCA entra por aqui. Logotipo de empresa real num
 * site comercial afirma uma relação que só existe com autorização por escrito,
 * e quem cadastra isso é o cliente, pelo admin.
 *
 *   pnpm --filter @nerp/web exec tsx scripts/seed-site-partners.ts
 *
 * Idempotente: cada registro é `upsert` por id, então rodar de novo não
 * duplica. Registros criados pelo admin não são tocados.
 */

const connectionString = process.env.DATABASE_URL ?? "";

/*
  O seed recusa banco que não seja local.

  Ele escreve empresa inventada em tabela que alimenta o site público: rodar
  contra um banco compartilhado por engano publicaria seis parceiros que não
  existem. `SEED_ALLOW_REMOTE=1` libera, para quem sabe o que está fazendo.
*/
const ehLocal = /(localhost|127\.0\.0\.1|host\.docker\.internal)/.test(
  connectionString,
);

if (!ehLocal && process.env.SEED_ALLOW_REMOTE !== "1") {
  const host = connectionString.replace(/^.*@/, "").split("/")[0] || "(vazio)";
  console.error(
    [
      "",
      "Este seed escreve PARCEIROS DE MENTIRA nas tabelas do site público.",
      `O DATABASE_URL aponta para um banco que não é local: ${host}`,
      "",
      "Se é mesmo o que você quer, rode com SEED_ALLOW_REMOTE=1.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const [indice, parceiro] of PARTNERS_SAMPLE.entries()) {
    const dados = {
      name: parceiro.name,
      photo: parceiro.photo,
      logo: parceiro.logo,
      story: parceiro.story,
      href: parceiro.href,
      position: indice,
      visible: true,
    };
    await prisma.sitePartner.upsert({
      where: { id: parceiro.id },
      create: { id: parceiro.id, ...dados },
      update: dados,
    });
  }

  for (const [indice, marca] of BRANDS_SAMPLE.entries()) {
    const dados = {
      name: marca.name,
      logo: marca.logo,
      href: marca.href,
      position: indice,
      visible: true,
    };
    await prisma.siteBrand.upsert({
      where: { id: marca.id },
      create: { id: marca.id, ...dados },
      update: dados,
    });
  }

  console.log(
    `Semeados ${PARTNERS_SAMPLE.length} parceiros e ${BRANDS_SAMPLE.length} marcas — todos fictícios.`,
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
