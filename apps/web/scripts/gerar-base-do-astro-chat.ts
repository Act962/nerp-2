/**
 * Gera o que se cola no ASTRO CHAT do Órbita para o ASTRO de lá atender o
 * site da ÓRBITA: as bases de conhecimento, a partir do catálogo do site.
 *
 *   pnpm --filter @nerp/web exec tsx scripts/gerar-base-do-astro-chat.ts
 *
 * Existe porque o catálogo muda (entrou ferramenta, mudou o texto de uma
 * página) e a base do Órbita é uma CÓPIA: sem regenerar, o ASTRO segue
 * falando do catálogo de ontem. A fonte é a mesma que o consultor do site
 * usava — `@nerp/site-content` —, então o que sai aqui é o que está nas
 * páginas.
 *
 * Os arquivos saem em pedaços porque o Órbita corta cada base em 20 mil
 * caracteres e soma no máximo 60 mil entre todas as marcadas no site. Um
 * arquivo só, com as 31 ferramentas, chegaria lá pela metade — e sem aviso.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONSULTOR_TOOL_IDS,
  detalharFerramenta,
  detalharSegmento,
  explicarMetodo,
  SEGMENTS,
} from "@nerp/site-content";

const SITE = "https://orbitatec.com.br";
/** Folga sobre o corte de 20 mil do Órbita. */
const TETO_POR_BASE = 18_500;
const TETO_TOTAL = 60_000;

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, "../../../docs/astro-chat-orbitatec");

function ferramenta(id: string): string | null {
  const f = detalharFerramenta(id);
  if (!f) return null;
  return [
    `## ${f.nome}`,
    `${f.tagline}. ${f.resumo}`,
    `O que faz: ${f.funcionalidades.map((x) => `${x.titulo} (${x.texto.replace(/\.$/, "")})`).join("; ")}.`,
    `O cliente passa a ter: ${f.ganhos.join("; ")}.`,
    `Resolve: ${f.dores.join("; ")}.`,
    f.href ? `Página: ${SITE}${f.href}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Junta os blocos em bases que cabem no corte, sem partir um bloco ao meio. */
function empacotar(titulo: string, blocos: string[]): string[] {
  const bases: string[] = [];
  let atual = "";
  for (const bloco of blocos) {
    if (atual && atual.length + bloco.length + 2 > TETO_POR_BASE) {
      bases.push(atual);
      atual = "";
    }
    atual = atual ? `${atual}\n\n${bloco}` : bloco;
  }
  if (atual) bases.push(atual);
  return bases.map(
    (corpo, i) =>
      `# ${titulo}${bases.length > 1 ? ` — parte ${i + 1} de ${bases.length}` : ""}\n\n${corpo}\n`,
  );
}

const ferramentas = CONSULTOR_TOOL_IDS.map(ferramenta).filter(
  (bloco): bloco is string => Boolean(bloco),
);

const segmentos = SEGMENTS.map((segmento) => {
  const s = detalharSegmento(segmento.id);
  if (!s) return null;
  return [
    `## ${s.nome}`,
    s.resumo,
    `Ferramentas que costumam pesar: ${s.ferramentas.map((f) => f.nome).join(", ")}.`,
    `Página: ${SITE}/segmentos/${s.id}`,
  ].join("\n");
}).filter((bloco): bloco is string => Boolean(bloco));

const metodo = explicarMetodo();
const etapas = metodo.etapas.map((etapa) =>
  [
    `## ${etapa.mark} — ${etapa.title}`,
    `Pergunta: ${etapa.question}`,
    etapa.text,
    etapa.bullets.length > 0
      ? `Perguntas da etapa: ${etapa.bullets.join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n"),
);

const bases = [
  ...empacotar("ÓRBITA HUB — as ferramentas da suíte", [
    `A ÓRBITA HUB é uma suíte de ${ferramentas.length} ferramentas que trabalham sobre a mesma base: o que uma escreve, a outra já enxerga. Esta lista é fechada — não existe ferramenta da ÓRBITA fora dela.`,
    ...ferramentas,
  ]),
  ...empacotar("ÓRBITA HUB — segmentos e o Método N.A.S.A.", [
    "# Segmentos atendidos",
    ...segmentos,
    "# Método N.A.S.A.",
    "O Método N.A.S.A. é o jeito de a ÓRBITA conduzir um projeto, não um produto. São quatro etapas, nesta ordem.",
    ...etapas,
  ]),
];

mkdirSync(DESTINO, { recursive: true });
// Uma geração com menos partes não pode deixar a parte velha para trás: ela
// seria cadastrada junto, com o catálogo antigo.
for (const arquivo of readdirSync(DESTINO)) {
  if (/^base-\d+\.md$/.test(arquivo)) rmSync(join(DESTINO, arquivo));
}

let total = 0;
bases.forEach((base, i) => {
  const arquivo = `base-${i + 1}.md`;
  writeFileSync(join(DESTINO, arquivo), base);
  total += base.length;
  console.log(`${arquivo}: ${base.length} caracteres`);
});

console.log(`total: ${total} de ${TETO_TOTAL}`);
if (total > TETO_TOTAL) {
  console.error(
    "Passou do teto do Órbita: as últimas bases seriam ignoradas. Enxugue o texto das ferramentas antes de cadastrar.",
  );
  process.exit(1);
}
