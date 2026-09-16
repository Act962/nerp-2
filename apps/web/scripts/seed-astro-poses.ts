import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { cenaNova, slugificarAnimacao } from "@nerp/site-content";
import { PrismaClient } from "@/generated/prisma/client";
import type { Manifesto, Pecas } from "@/features/site/lib/astro-catalogo";
import {
  fundoDaPose,
  montarPose,
  POSES,
} from "@/features/site/lib/astro-poses";

/**
 * Leva as 25 poses do ASTRO para o banco, para o editor ter de onde partir.
 *
 * Idempotente, e com a mesma regra do `seed-site-content.ts`: o seed garante
 * que a pose EXISTE, não que ela está como nasceu. Cena já editada no admin
 * fica como está — rodar de novo não desfaz o trabalho de ninguém.
 *
 * As camadas são montadas aqui, e não copiadas de um JSON congelado: saem do
 * mesmo catálogo que o editor usa, lido do disco. Uma peça redesenhada entra
 * nas 25 na próxima rodada.
 *
 * O `momento` NÃO é gravado. Pose é ponto de partida, não decisão de o que vai
 * ao ar: quem publica é quem edita, escolhendo o momento na tela. Semear 25
 * cenas já no ar seria trocar o conteúdo do site sem ninguém pedir.
 *
 *   SEED_DATABASE_URL="postgres://..." \
 *     pnpm --filter @nerp/web exec tsx scripts/seed-astro-poses.ts
 */

const connectionString = process.env.SEED_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Defina SEED_DATABASE_URL com o banco de destino antes de rodar o seed.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** O catálogo mora no `apps/site`; aqui ele é lido do disco, não por HTTP. */
const CAMADAS = path.join(
  process.cwd(),
  "..",
  "site",
  "public",
  "astro",
  "camadas",
);

async function lerJson<T>(arquivo: string): Promise<T> {
  return JSON.parse(await readFile(path.join(CAMADAS, arquivo), "utf8")) as T;
}

async function main() {
  const [manifesto, pecas] = await Promise.all([
    lerJson<Manifesto>("manifesto.json"),
    lerJson<Pecas>("pecas.json"),
  ]);

  let criadas = 0;
  let mantidas = 0;

  for (const pose of POSES) {
    const slug = slugificarAnimacao(pose.nome);
    const existente = await prisma.siteAstroAnimacao.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existente) {
      mantidas++;
      continue;
    }

    const cena = {
      ...cenaNova(pose.nome),
      slug,
      momento: null,
      camadas: [fundoDaPose(), ...montarPose(pose, manifesto, pecas)],
      atualizadaEm: new Date().toISOString(),
    };

    await prisma.siteAstroAnimacao.create({
      data: { slug, nome: pose.nome, momento: null, cena, criadaPor: "seed" },
    });
    criadas++;
  }

  console.log(`poses do ASTRO: ${criadas} criadas, ${mantidas} já existiam`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
