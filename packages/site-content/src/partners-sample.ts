import type { SiteBrand, SitePartner, SitePartnersResponse } from "./partners";

/**
 * Parceiros e marcas de MENTIRA, para desenvolvimento.
 *
 * ⚠️ Nada aqui é real e nada aqui pode ir ao ar. Os nomes são inventados, e os
 * logotipos e as fotos são desenhados em SVG na hora — nenhum arquivo de marca
 * de terceiro entra no repositório. Logotipo de empresa real num site
 * comercial afirma uma relação que só existe com autorização por escrito, e é
 * por isso que o conteúdo de verdade só entra pelo admin.
 *
 * Serve a dois lugares, que precisam concordar:
 *
 * - `apps/site`, atrás de `?parceiros=demo` e só fora de produção, para
 *   conferir o leiaute antes de existir cadastro;
 * - `apps/web/scripts/seed-site-partners.ts`, para encher um banco LOCAL e
 *   exercitar o caminho inteiro — admin, API e site.
 */

const PALETA = [
  { fundo: "#0a93f7", tinta: "#ffffff" },
  { fundo: "#0f4a76", tinta: "#e8f4ff" },
  { fundo: "#f2b705", tinta: "#052440" },
  { fundo: "#12805c", tinta: "#ffffff" },
  { fundo: "#c2410c", tinta: "#fff7ed" },
  { fundo: "#5b21b6", tinta: "#f5f3ff" },
];

function svg(markup: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}

/** Um logotipo de mentira: a palavra desenhada, sem imitar marca nenhuma. */
function logoFicticio(nome: string, indice: number) {
  const { fundo, tinta } = PALETA[indice % PALETA.length];
  const inicial = nome[0].toUpperCase();
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 72">
  <rect x="4" y="16" width="40" height="40" rx="11" fill="${fundo}"/>
  <text x="24" y="45" text-anchor="middle" font-family="Inter,Helvetica,sans-serif"
    font-size="24" font-weight="700" fill="${tinta}">${inicial}</text>
  <text x="56" y="45" font-family="Inter,Helvetica,sans-serif" font-size="23"
    font-weight="600" letter-spacing="-0.6" fill="${fundo}">${nome}</text>
</svg>`);
}

/** Uma "foto" de mentira: campo de cor com formas, para o cartão ter peso. */
function fotoFicticia(nome: string, indice: number) {
  const { fundo } = PALETA[indice % PALETA.length];
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${fundo}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#031627" stop-opacity="0.98"/>
    </linearGradient>
  </defs>
  <rect width="320" height="200" fill="url(#g)"/>
  <circle cx="248" cy="52" r="66" fill="#ffffff" opacity="0.10"/>
  <circle cx="70" cy="168" r="92" fill="#ffffff" opacity="0.07"/>
  <text x="20" y="182" font-family="Inter,Helvetica,sans-serif" font-size="13"
    font-weight="500" fill="#ffffff" opacity="0.72">foto · ${nome}</text>
</svg>`);
}

const PARCEIROS_FICTICIOS = [
  {
    nome: "Meridiano",
    historia:
      "Distribuidora de bens de consumo com sete centros no Nordeste. Trocou três planilhas e um sistema legado pela suíte inteira, e passou a fechar o mês no dia 2.",
  },
  {
    nome: "Alvorada",
    historia:
      "Rede de dezoito lojas de material de construção. Implantou o PDV e o catálogo promocional na mesma semana; o encarte que levava dois dias para montar agora sai numa tarde.",
  },
  {
    nome: "Portal Sete",
    historia:
      "Consultoria de trade marketing que revende e implanta a suíte. Hoje entrega book de execução para catorze indústrias sem sair da plataforma.",
  },
  {
    nome: "Casa Nova",
    historia:
      "Supermercado de bairro que virou rede com quatro unidades. Começou pelo estoque, continuou pelo financeiro e nunca mais fez inventário no papel.",
  },
  {
    nome: "Rota Norte",
    historia:
      "Operação logística com cento e vinte veículos. Usa a suíte para amarrar pedido, separação e entrega no mesmo lugar.",
  },
  {
    nome: "Ateliê Comum",
    historia:
      "Indústria de móveis planejados. Conectou o catálogo ao site e o pedido do vendedor deixou de ser um PDF perdido no e-mail.",
  },
];

const MARCAS_FICTICIAS = [
  "Meridiano",
  "Alvorada",
  "Portal Sete",
  "Casa Nova",
  "Rota Norte",
  "Ateliê Comum",
  "Vale Claro",
  "Prisma",
  "Bandeirola",
  "Céu Aberto",
  "Contorno",
  "Mirante",
];

export const PARTNERS_SAMPLE: SitePartner[] = PARCEIROS_FICTICIOS.map(
  (parceiro, indice) => ({
    id: `amostra-parceiro-${indice + 1}`,
    name: parceiro.nome,
    photo: fotoFicticia(parceiro.nome, indice),
    logo: logoFicticio(parceiro.nome, indice),
    story: parceiro.historia,
    href: "",
  }),
);

export const BRANDS_SAMPLE: SiteBrand[] = MARCAS_FICTICIAS.map(
  (nome, indice) => ({
    id: `amostra-marca-${indice + 1}`,
    name: nome,
    logo: logoFicticio(nome, indice),
    href: "",
  }),
);

export const PARTNERS_SAMPLE_RESPONSE: SitePartnersResponse = {
  partners: PARTNERS_SAMPLE,
  brands: BRANDS_SAMPLE,
};
