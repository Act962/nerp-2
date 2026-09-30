/**
 * As cores da vitrine.
 *
 * Módulo neutro (sem `server-only`): o painel do admin e a loja pública usam a
 * mesma conta de contraste. Duas contas diferentes seria a forma mais fácil de
 * o preview do painel mostrar um texto legível e a loja mostrar outro.
 */

/** O fundo de quem nunca escolheu cor: o neutro claro que a loja já tinha. */
export const FUNDO_PADRAO_CATALOGO = "#f5f5f5";

/** A cor de tema de quem nunca escolheu nenhuma — o mesmo default do banco. */
export const TEMA_PADRAO_CATALOGO = "#00bcd4";

export function isHexValido(valor: string | null | undefined): valor is string {
  return !!valor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(valor.trim());
}

function canais(hex: string): [number, number, number] {
  const limpo = hex.trim().replace("#", "");
  const cheio =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  return [
    Number.parseInt(cheio.slice(0, 2), 16),
    Number.parseInt(cheio.slice(2, 4), 16),
    Number.parseInt(cheio.slice(4, 6), 16),
  ];
}

/**
 * A luminância relativa da WCAG. É ela, e não a média dos canais, que decide
 * se um fundo é escuro: o verde puro pesa dez vezes mais que o azul puro para
 * o olho, e a média trataria os dois como o mesmo cinza.
 */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((canal) => {
    const v = canal / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A tinta que se lê sobre este fundo. */
export function tintaSobre(hex: string): string {
  return luminancia(hex) > 0.45 ? "#111111" : "#fafafa";
}

/** O fundo é escuro a ponto de exigir texto claro? */
export function fundoEscuro(hex: string): boolean {
  return luminancia(hex) <= 0.45;
}

/** Razão de contraste da WCAG entre duas cores: 1 (igual) a 21 (preto/branco). */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

type Hsl = { h: number; s: number; l: number };

function paraHsl(hex: string): Hsl {
  const [r, g, b] = canais(hex).map((canal) => canal / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

function deHsl({ h, s, l }: Hsl): string {
  const limitar = (v: number) => Math.min(1, Math.max(0, v));
  const [ss, ll] = [limitar(s), limitar(l)];
  const k = (n: number) => (n + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) =>
    ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * Empurra a luminosidade da cor até ela se destacar do fundo.
 *
 * 3:1 é o mínimo da WCAG para elementos gráficos — botão, selo, borda ativa.
 * Mexe só no L: o matiz é a identidade da marca, e é o que a pessoa escolheu.
 */
export function destacarSobre(cor: string, fundo: string, minimo = 3): string {
  if (contraste(cor, fundo) >= minimo) return cor;
  const hsl = paraHsl(cor);
  const escurecer = !fundoEscuro(fundo);
  for (let passo = 1; passo <= 20; passo++) {
    const l = escurecer ? hsl.l - passo * 0.04 : hsl.l + passo * 0.04;
    const candidata = deHsl({ ...hsl, l });
    if (contraste(candidata, fundo) >= minimo) return candidata;
  }
  return escurecer ? "#111111" : "#fafafa";
}

export type Combinacao = {
  id: string;
  nome: string;
  descricao: string;
  tema: string;
  cabecalho: string;
  fundo: string;
};

/**
 * As combinações equilibradas a partir de uma cor da marca.
 *
 * Cada uma já sai com o tema ajustado para ter contraste com o fundo — é o
 * "equilíbrio": a pessoa escolhe um clima, não precisa saber de luminância.
 */
export function gerarCombinacoes(base: string): Combinacao[] {
  if (!isHexValido(base)) return [];
  const { h, s } = paraHsl(base);
  const sat = Math.max(s, 0.35);
  const complementar = deHsl({ h: (h + 180) % 360, s: sat, l: 0.5 });

  const combinacoes: Combinacao[] = [
    {
      id: "clara",
      nome: "Clara",
      descricao: "Topo branco, fundo quase branco e a marca nos botões.",
      tema: base,
      cabecalho: "#ffffff",
      fundo: deHsl({ h, s: sat * 0.25, l: 0.97 }),
    },
    {
      id: "marca-no-topo",
      nome: "Marca no topo",
      descricao: "O cabeçalho inteiro na cor da marca.",
      tema: base,
      cabecalho: base,
      fundo: "#f5f5f5",
    },
    {
      id: "suave",
      nome: "Suave",
      descricao: "Tons pastel da marca, para uma loja delicada.",
      tema: deHsl({ h, s: sat, l: 0.42 }),
      cabecalho: deHsl({ h, s: sat * 0.7, l: 0.9 }),
      fundo: deHsl({ h, s: sat * 0.35, l: 0.96 }),
    },
    {
      id: "vibrante",
      nome: "Vibrante",
      descricao: "Marca no topo e destaques na cor oposta do círculo.",
      tema: complementar,
      cabecalho: base,
      fundo: deHsl({ h, s: sat * 0.3, l: 0.95 }),
    },
    {
      id: "monocromatica",
      nome: "Monocromática",
      descricao: "Tudo em tons da mesma cor, do escuro ao claro.",
      tema: deHsl({ h, s: sat, l: 0.45 }),
      cabecalho: deHsl({ h, s: sat, l: 0.22 }),
      fundo: deHsl({ h, s: sat * 0.4, l: 0.94 }),
    },
    {
      id: "escura",
      nome: "Escura",
      descricao: "Fundo escuro, com a marca acendendo os destaques.",
      tema: base,
      cabecalho: deHsl({ h, s: sat * 0.3, l: 0.1 }),
      fundo: deHsl({ h, s: sat * 0.25, l: 0.14 }),
    },
  ];

  return combinacoes.map((combinacao) => ({
    ...combinacao,
    tema: destacarSobre(combinacao.tema, combinacao.fundo),
  }));
}

/**
 * As cores que dominam uma imagem, para sugerir a paleta a partir da logo.
 *
 * Agrupa os pixels em "caixas" de cor e devolve as mais frequentes, pulando
 * o quase-branco e o quase-preto — são fundo e contorno, não a marca.
 */
export function coresDominantes(
  pixels: Uint8ClampedArray,
  quantas = 5,
): string[] {
  const caixas = new Map<
    string,
    { n: number; r: number; g: number; b: number }
  >();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = [
      pixels[i],
      pixels[i + 1],
      pixels[i + 2],
      pixels[i + 3],
    ];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 235 || max < 20) continue;
    const chave = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const caixa = caixas.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
    caixa.n++;
    caixa.r += r;
    caixa.g += g;
    caixa.b += b;
    caixas.set(chave, caixa);
  }
  return [...caixas.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, quantas)
    .map(
      ({ n, r, g, b }) =>
        `#${[r, g, b]
          .map((v) =>
            Math.round(v / n)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")}`,
    );
}

export type CoresDoCartao = { fundo: string; icone: string; texto: string };

/**
 * As cores do cartão de categoria, com o que falta preenchido pelo equilíbrio.
 *
 * Sem escolha, o cartão é branco — e não o `bg-card` do tema do app, que no
 * modo escuro pintava o cartão de preto sobre uma vitrine clara. O ícone cai
 * no tema ajustado para aparecer no fundo; o texto, na tinta legível.
 */
export function coresDoCartao(
  escolhidas: {
    fundo?: string | null;
    icone?: string | null;
    texto?: string | null;
  },
  tema: string,
): CoresDoCartao {
  const fundo = isHexValido(escolhidas.fundo) ? escolhidas.fundo : "#ffffff";
  return {
    fundo,
    icone: isHexValido(escolhidas.icone)
      ? escolhidas.icone
      : destacarSobre(tema, fundo),
    texto: isHexValido(escolhidas.texto) ? escolhidas.texto : tintaSobre(fundo),
  };
}
