import "server-only";

import prisma from "@/lib/db";
import {
  ASTRO_CONFIG_KEY,
  lerConfig,
} from "@/features/astro-consultor/server/provider";
import { gerarImagemComFallback } from "@/features/astro/server/gerar-imagem";
import { custoDaImagem } from "@/features/astro/server/modelos";
import { arredondarEstrelas, emEstrelas } from "@/features/stars/lib/decimal";
import { ACOES } from "@/features/stars/server/debitar";
import {
  type ClimaOferta,
  type FormatoOferta,
  ZONAS_DA_ARTE,
  alturaDaPagina,
} from "../lib/compor-oferta";
import { ARTE_DO_NIVEL, type NivelOferta } from "../lib/oferta-desenhada";

/** ★ de uma arte. `StarRule` de `astro_oferta_arte` manda, se houver. */
export async function precoDaArte(
  organizationId: string,
  nivel: NivelOferta,
): Promise<number> {
  const regra = await prisma.starRule.findUnique({
    where: {
      organizationId_actionKey: {
        organizationId,
        actionKey: ACOES.astroOfertaArte,
      },
    },
    select: { stars: true, isActive: true },
  });
  if (regra) return regra.isActive ? Math.max(0, emEstrelas(regra.stars)) : 0;
  const linha = await prisma.siteSetting.findUnique({
    where: { key: ASTRO_CONFIG_KEY },
  });
  const config = lerConfig(linha?.value);
  return arredondarEstrelas(
    custoDaImagem({
      ...ARTE_DO_NIVEL[nivel],
      base: { dolar: config.dolar, realPorEstrela: config.realPorEstrela },
    }).estrelas,
  );
}

const ESTILO: Record<ClimaOferta, string> = {
  impacto:
    "varejo de impacto: vermelho intenso, raios de luz partindo do centro, vinheta escura nas bordas; lettering branco e amarelo com contorno vermelho-escuro e sombra 3D",
  feira:
    "hortifruti e feira: verde vivo, madeira rústica, folhas e gotas de frescor; lettering amarelo e branco com contorno verde-escuro",
  elegante:
    "sofisticado: preto profundo com dourado, luz suave e brilhos discretos; lettering dourado com serifa e relevo",
  minimalista:
    "moderno e limpo: fundo claro com formas geométricas suaves e sombra leve; lettering na cor principal, sem exageros",
  datas:
    "festivo de data especial: confetes, brilhos e luzes; lettering branco com contorno colorido e sombra 3D",
};

/** A arte sai 1024×1536 (2:3) e a página a cobre: onde cai cada faixa NELA. */
function naImagem(formato: FormatoOferta, fracaoDaPagina: number): number {
  const PAGINA = {
    a4: { pageSize: "portrait", pageAspect: 1 / Math.SQRT2 },
    story: { pageSize: "story" },
    feed: { pageSize: "portrait", pageAspect: 0.8 },
  } as const;
  const H = alturaDaPagina(PAGINA[formato]);
  // Página mais larga que 2:3: a arte é escalada pela largura e perde
  // topo e base; mais estreita (story), perde só as laterais.
  const alturaDaArte = 1080 * 1.5;
  if (1080 / H <= 2 / 3) return fracaoDaPagina;
  const corte = (alturaDaArte - H) / 2;
  return (fracaoDaPagina * H + corte) / alturaDaArte;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function promptDaArte(entrada: {
  formato: FormatoOferta;
  nome: string;
  clima: ClimaOferta;
  corBase?: string;
  temLogo: boolean;
}): string {
  const z = ZONAS_DA_ARTE;
  const f = (v: number) => pct(naImagem(entrada.formato, v));
  return [
    "Arte de fundo para encarte publicitário vertical de supermercado brasileiro, com qualidade de designer gráfico premium, pronta para receber os produtos por cima.",
    `Estilo ${ESTILO[entrada.clima]}.`,
    entrada.corBase ? `Cor predominante ${entrada.corBase}.` : "",
    `FAIXA DE CIMA (de ${f(z.titulo.de)} a ${f(z.titulo.ate)} da altura): título em lettering 3D enorme e chamativo com o texto exato "${entrada.nome.toUpperCase()}", grafia exata, sobre um recorte de papel rasgado com bordas brancas irregulares.${entrada.temLogo ? " Deixe o canto superior direito vazio (reservado ao logo da loja)." : ""}`,
    `FAIXA DO MEIO (de ${f(z.produtos.de)} a ${f(z.informacoes.ate)} da altura): SOMENTE o fundo — raios de luz, textura e profundidade. Nenhum objeto, produto, embalagem, texto, número, preço, selo, ícone ou moldura nesta faixa: ela será coberta pelos produtos.`,
    `FAIXA DE BAIXO (de ${f(z.rodape.de)} a ${f(z.rodape.ate)} da altura): barra escura horizontal de ponta a ponta, lisa ou com textura sutil, dividida ao meio por um fino traço vertical claro. SEM ícones e SEM nenhum texto — os dados entram por cima.`,
    "O único texto da arte inteira é o título. Sem pessoas, sem marcas, sem produtos, sem preços.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Gera a arte e guarda no R2. Não cobra: quem chama soma à geração. */
export async function gerarArteDaOferta(entrada: {
  organizationId: string;
  nivel: NivelOferta;
  formato: FormatoOferta;
  nome: string;
  clima: ClimaOferta;
  corBase?: string;
  temLogo: boolean;
}): Promise<{ chave: string; estrelas: number }> {
  const { modelo, qualidade } = ARTE_DO_NIVEL[entrada.nivel];
  const [imagem, estrelas] = await Promise.all([
    gerarImagemComFallback({
      organizationId: entrada.organizationId,
      descricao: promptDaArte(entrada),
      modelo,
      qualidade,
      proporcao: "4:5",
      pasta: "catalogo/artes",
    }),
    precoDaArte(entrada.organizationId, entrada.nivel),
  ]);
  return { chave: imagem.chave, estrelas };
}
