// Copia as peças do ASTRO do `apps/site` para o /public daqui.
//
// A arte do mascote é do SITE: é ele quem desenha o ASTRO para o visitante, e
// ele precisa continuar de pé com este app fora do ar. Mas o editor de
// `/site/animacoes` mora aqui e precisa das mesmas peças — e precisa delas na
// MESMA origem, senão o canvas do Konva fica marcado ("tainted") e a
// exportação de quadro para de funcionar.
//
// Copiar resolve os dois: uma fonte só, versionada no `apps/site`, servida nos
// dois endereços. E como o caminho é idêntico (`/astro/camadas/...`), a cena
// gravada no banco desenha igual dos dois lados sem tradução nenhuma.
//
// O destino é ignorado pelo git de propósito — arte commitada em dois lugares
// é arte que desatualiza em um deles.

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const origem = join(aqui, "..", "..", "site", "public", "astro", "camadas");
const destino = join(process.cwd(), "public", "astro", "camadas");

if (!existsSync(origem)) {
  // Não é motivo para derrubar o build: quem não mexe no editor de animações
  // não precisa das peças, e o `apps/site` pode não estar no checkout.
  console.warn(`astro/camadas: nada em ${origem} — o editor abre sem as peças`);
  process.exit(0);
}

rmSync(destino, { recursive: true, force: true });
mkdirSync(dirname(destino), { recursive: true });
cpSync(origem, destino, { recursive: true });

console.log(`astro/camadas → ${destino}`);
