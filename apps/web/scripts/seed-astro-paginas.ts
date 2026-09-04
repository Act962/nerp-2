import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  astroPaginaSchema,
  compareFor,
  findCatalogTool,
  METODO_SLUG,
  RAW_TOOLS,
  SEGMENTS,
  solutionSlug,
} from "@nerp/site-content";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * O que o Astro sabe de cada página do site.
 *
 * Três campos, três origens diferentes — e é essa divisão que mantém o seed
 * honesto:
 *
 * - o **resumo** é o `summary` da própria ferramenta, escrito pela casa. Nada
 *   é reescrito aqui: o Astro fala da página com o texto que já vende ela;
 * - as **palavras-chave** saem do catálogo por derivação (nome, tagline,
 *   títulos das funcionalidades e a lista de dores do `compare.less`). São o
 *   vocabulário real da página, não uma lista imaginada;
 * - os **balões** são escritos à mão, aqui embaixo. Voz não se deriva de
 *   dado — e eles aparecem em toda visita, então gerar por modelo seria caro
 *   e pior.
 *
 * Idempotente e NÃO destrutivo: página que já tem fala cadastrada é pulada.
 * O seed garante que o Astro sabe falar de tudo, não que ele está com o texto
 * original — quem editou no admin manda.
 *
 *   SEED_DATABASE_URL="postgres://..." \
 *     pnpm --filter @nerp/web exec tsx scripts/seed-astro-paginas.ts
 *
 * `SEED_ASTRO_REFRESH=1` sobrescreve o que já existe. Use quando a intenção
 * for justamente devolver o texto do catálogo.
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
const REFRESH = process.env.SEED_ASTRO_REFRESH === "1";

/**
 * Os balões, por página.
 *
 * Dois por página: o primeiro reage ao que a pessoa está lendo, o segundo
 * oferece conversa. A regra editorial do site vale aqui também — nada de
 * promessa de resultado. "Encarte sem designer" é o que a ferramenta faz;
 * "encarte que vende mais" seria promessa.
 */
const BALOES: Record<string, [string, string]> = {
  // ── comercial ───────────────────────────────────────────────────────────
  tracking: [
    "Opa, o CRM… esse aqui é figurinha carimbada",
    "Se quiser, te explico como monta o funil",
  ],
  chat: [
    "WhatsApp da empresa num lugar só. Dá até paz",
    "Posso te contar como conecta, é rapidinho",
  ],
  forms: [
    "Formulário que vira lead sozinho 👀",
    "Te mostro como a resposta cai no funil?",
  ],
  agendas: [
    "Agenda pública, sem aquele vai-e-volta de horário",
    "Quer saber como o horário marcado vira contato?",
  ],
  forge: [
    "Proposta com assinatura digital, sem imprimir nada",
    "Te explico como o aceite chega no atendimento",
  ],
  linnker: [
    "Link da bio que captura lead. Sacada boa",
    "Quer saber como o QR entra nessa história?",
  ],
  comments: [
    "Comentário no Insta virando lead. É isso mesmo",
    "Te explico como a palavra-chave dispara",
  ],
  disparo: [
    "API oficial da Meta, sem gambiarra",
    "Posso te falar da janela de 24h, se interessar",
  ],

  // ── gestão ──────────────────────────────────────────────────────────────
  workspaces: [
    "Quadro de tarefas com chat dentro. Bem prático",
    "Quer ver como o setor inteiro cabe num quadro?",
  ],
  payment: [
    "Financeiro com régua de cobrança e tudo mais",
    "Posso te contar com quais gateways ele fala",
  ],
  nbox: [
    "Contrato, arte e planilha no mesmo lugar do processo",
    "Te explico como funciona a cota, se rolar",
  ],
  ranking: [
    "Pódio no telão da loja. Quem produz aparece 🏆",
    "Quer saber como importa as metas?",
  ],
  "space-station": [
    "Escritório virtual mesmo, com avatar e áudio por proximidade",
    "Te levo num tour, se quiser",
  ],
  astro: [
    "Ué, essa página é sobre mim 👋",
    "Quer saber o que eu faço lá dentro do sistema?",
  ],

  // ── marketing ───────────────────────────────────────────────────────────
  planner: [
    "Planejamento de marketing com IA no meio",
    "Te mostro o que ele faz com o briefing?",
  ],
  pages: [
    "Landing page com 26 blocos prontos",
    "Dá até pra comprar o domínio sem sair daqui",
  ],
  route: [
    "Área de membros com checkout próprio",
    "Quer saber como monetiza o que a empresa já sabe?",
  ],
  trafego: [
    "TrafeGO! Tráfego pago com cabeça, não no chute",
    "Ficou com alguma dúvida? Manda aí",
  ],

  // ── loja ────────────────────────────────────────────────────────────────
  nerp: [
    "Esse aqui é a ponte com a operação da loja",
    "Quer entender como os dois lados conversam?",
  ],
  pdv: [
    "Frente de caixa com fiscal e fechamento de turno",
    "Te conto como funciona o cancelamento autorizado",
  ],
  estoque: [
    "Saldo por loja, entrada e saída. O básico bem feito",
    "Quer saber como o custo entra nessa conta?",
  ],
  inventario: [
    "Seu celular virando coletor. Sem comprar aparelho",
    "Te explico como a divergência aparece na hora",
  ],
  "catalogo-promocional": [
    "Encarte da semana sem designer. Salva a segunda-feira",
    "Quer ver como o preço sai diferente por loja?",
  ],
  "qr-preco": [
    "O cliente escaneia, vê o preço, e a loja vê o interesse",
    "E sem rastrear pessoa nenhuma, viu",
  ],
  "catalogo-online": [
    "Vitrine ligada no PDV e no CRM. Mesmo produto, mesmo cliente",
    "Te explico como o carrinho vira pedido",
  ],
  planograma: [
    "Gôndola desenhada e comparada com a foto real",
    "Quer saber como sai o share de espaço?",
  ],
  book: [
    "A foto do campo virando book pra indústria",
    "Te mostro como as páginas se montam?",
  ],
  tradegram: [
    "Promotor, rota e foto de PDV. O campo inteiro",
    "Te explico como o book sai daqui",
  ],
};

/** Os segmentos falam da operação, não da ferramenta. */
const BALOES_SEGMENTO: Record<string, [string, string]> = {
  supermercados: [
    "Supermercado é corrida contra o giro, né?",
    "Te conto o que costuma pesar mais por aqui",
  ],
  clinicas: [
    "Clínica é agenda cheia e paciente que precisa voltar",
    "Quer ver o que a gente usa nesse ramo?",
  ],
  atacarejos: [
    "Atacado e varejo no mesmo CNPJ dá um nó, hein",
    "Te explico como fica o preço por canal",
  ],
  franquias: [
    "Rede inteira no mesmo padrão. O desafio é esse",
    "Quer saber como cada unidade mantém o ritmo?",
  ],
  food: [
    "Salão, delivery e cozinha puxando do mesmo estoque",
    "Te conto o que costuma resolver isso",
  ],
  automotivo: [
    "Orçamento, ordem de serviço e peça na bancada",
    "Quer ver o que a gente usa nesse ramo?",
  ],
};

/**
 * Palavras que aparecem em qualquer frase e não distinguem página nenhuma.
 * Sem esta lista, metade das páginas teria "sistema" e "empresa" na chave.
 */
const VAZIAS = new Set([
  "para",
  "pelo",
  "pela",
  "com",
  "sem",
  "que",
  "nao",
  "dos",
  "das",
  "por",
  "uma",
  "seu",
  "sua",
  "mesmo",
  "mesma",
  "todo",
  "toda",
  "cada",
  "mais",
  "menos",
  "onde",
  "como",
  "quando",
  "empresa",
  "negocio",
  "sistema",
  "plataforma",
  "ferramenta",
  "orbita",
  "proprio",
  "propria",
  "junto",
  "dentro",
  "sobre",
  "entre",
  "prontos",
  "pronto",
  "varios",
  "varias",
  "vira",
  "viram",
  "volta",
  "tudo",
  "coisa",
  "gente",
  "aqui",
  "isso",
  "esse",
  "essa",
]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * O vocabulário de uma página, na ordem em que ele aparece.
 *
 * Os títulos das funcionalidades vêm primeiro de propósito: são as palavras
 * mais específicas que a página tem ("planograma", "coletor", "gôndola"), e
 * são elas que fazem o Astro puxar o assunto certo.
 */
function derivarChaves(...fontes: string[]): string[] {
  const chaves: string[] = [];
  for (const fonte of fontes) {
    for (const bruto of normalizar(fonte).split(/[^a-z0-9]+/)) {
      if (bruto.length < 4 || VAZIAS.has(bruto)) continue;
      if (chaves.includes(bruto)) continue;
      chaves.push(bruto);
      if (chaves.length >= 12) return chaves;
    }
  }
  return chaves;
}

type Semente = { slug: string; ativo: boolean; config: unknown };

function sementesDasFerramentas(): Semente[] {
  const sementes: Semente[] = [];

  for (const tool of RAW_TOOLS) {
    const slug = solutionSlug(tool.id);
    if (!slug) continue;

    const comparacao = compareFor(tool.id);
    const chaves = derivarChaves(
      tool.name,
      tool.features.map((f) => f.title).join(" "),
      tool.tagline,
      (comparacao?.less ?? []).join(" "),
      tool.summary,
    );

    sementes.push({
      slug,
      ativo: true,
      config: astroPaginaSchema.parse({
        ativo: true,
        // Sem balão escrito, ele fica em silêncio nesta página em vez de
        // improvisar: uma fala genérica de mascote é pior que nenhuma.
        baloes: BALOES[tool.id] ?? [],
        palavrasChave: chaves,
        // O texto da casa, sem reescrita.
        resumo: tool.summary.slice(0, 600),
      }),
    });
  }

  return sementes;
}

function sementesDosSegmentos(): Semente[] {
  return SEGMENTS.map((segmento) => {
    const nomesDasFerramentas = segmento.tools
      .map((id) => findCatalogTool(id)?.name ?? "")
      .filter(Boolean);

    return {
      slug: segmento.id,
      ativo: true,
      config: astroPaginaSchema.parse({
        ativo: true,
        baloes: BALOES_SEGMENTO[segmento.id] ?? [],
        palavrasChave: derivarChaves(
          segmento.name,
          segmento.summary,
          nomesDasFerramentas.join(" "),
        ),
        resumo:
          `${segmento.summary} As ferramentas que mais pesam aqui: ${nomesDasFerramentas.join(", ")}.`.slice(
            0,
            600,
          ),
      }),
    };
  });
}

function sementeDoMetodo(): Semente {
  return {
    slug: METODO_SLUG,
    ativo: true,
    config: astroPaginaSchema.parse({
      ativo: true,
      baloes: [
        "O método é o que organiza tudo por aqui",
        "Quer que eu te explique as quatro etapas?",
      ],
      palavrasChave: [
        "metodo",
        "nasa",
        "necessidade",
        "analise",
        "sistematizacao",
        "acao",
        "diagnostico",
        "decisao",
      ],
      resumo:
        "Metodologia de gestão e tomada de decisão em quatro etapas — Necessidade, Análise, Sistematização e Ação. Transforma problemas e oportunidades em decisões e ações, evitando decidir por achismo. Desenvolvida por Weydson Lima.",
    }),
  };
}

async function main() {
  const sementes = [
    ...sementesDasFerramentas(),
    ...sementesDosSegmentos(),
    sementeDoMetodo(),
  ];

  let criadas = 0;
  let puladas = 0;
  let ausentes = 0;

  for (const semente of sementes) {
    const page = await prisma.sitePage.findUnique({
      where: { slug: semente.slug },
      select: { id: true, astro: true, status: true },
    });

    if (!page) {
      ausentes += 1;
      console.warn(`· ${semente.slug} — página não existe no banco, pulando`);
      continue;
    }

    // Já tem fala cadastrada: quem editou no admin manda.
    const jaTem =
      page.astro !== null &&
      typeof page.astro === "object" &&
      Array.isArray((page.astro as { baloes?: unknown }).baloes) &&
      ((page.astro as { baloes: unknown[] }).baloes.length > 0 ||
        ((page.astro as { palavrasChave?: unknown[] }).palavrasChave?.length ??
          0) > 0);

    if (jaTem && !REFRESH) {
      puladas += 1;
      continue;
    }

    await prisma.sitePage.update({
      where: { id: page.id },
      data: {
        astro: semente.config as never,
        // A coluna publicada só é tocada se a página já está no ar. Página em
        // rascunho recebe o rascunho e vai ao ar quando for publicada, junto
        // com os blocos — que é a regra do resto do editor.
        ...(page.status === "PUBLISHED"
          ? { astroPublished: semente.config as never }
          : {}),
      },
    });
    criadas += 1;
  }

  console.log(
    `\nAstro: ${criadas} página(s) semeada(s), ${puladas} já tinha(m) fala, ${ausentes} sem página no banco.`,
  );
  if (puladas > 0 && !REFRESH) {
    console.log("Para sobrescrever, rode de novo com SEED_ASTRO_REFRESH=1.");
  }
  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error(erro);
  await prisma.$disconnect();
  process.exit(1);
});
