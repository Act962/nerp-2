// Comandos ESC/POS crus.
//
// A impressora térmica não fala HTML: ela recebe bytes, e cada byte é ou texto
// ou um comando de uma ou duas letras de controle. Este arquivo é a tradução
// literal do manual — nenhuma regra de cupom mora aqui.

export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;

/** ESC @ — reinicia a impressora: limpa negrito, alinhamento e tamanho. */
export const INIT = [ESC, 0x40];

/** ESC a n — 0 esquerda, 1 centro, 2 direita. */
export function align(to: "left" | "center" | "right"): number[] {
  const n = to === "center" ? 1 : to === "right" ? 2 : 0;
  return [ESC, 0x61, n];
}

/** ESC E n — negrito ligado/desligado. */
export function bold(on: boolean): number[] {
  return [ESC, 0x45, on ? 1 : 0];
}

/**
 * GS ! n — tamanho do caractere.
 *
 * O byte é dividido ao meio: nibble alto multiplica a LARGURA, nibble baixo
 * multiplica a ALTURA, ambos de 0 (1×) a 7 (8×). Dobrar os dois é `0x11`.
 */
export function size(width: 1 | 2, height: 1 | 2): number[] {
  const n = ((width - 1) << 4) | (height - 1);
  return [GS, 0x21, n];
}

/**
 * ESC t n — tabela de caracteres.
 *
 * Sem isto o texto sai em CP437 e todo acento vira símbolo. CP860 é a tabela
 * portuguesa; CP850 é a multilíngue, que muitas impressoras genéricas honram
 * melhor. Qual funciona depende do aparelho — por isso é ajuste do usuário.
 */
export const CODEPAGE_COMMAND: Record<"CP437" | "CP850" | "CP860", number[]> = {
  CP437: [ESC, 0x74, 0],
  CP850: [ESC, 0x74, 2],
  CP860: [ESC, 0x74, 3],
};

/** ESC d n — avança n linhas. */
export function feed(lines: number): number[] {
  return [ESC, 0x64, Math.max(0, Math.min(255, lines))];
}

/**
 * GS V m n — corta o papel.
 *
 * Opcional de propósito: a maioria das 58mm Bluetooth não tem guilhotina, e
 * parte delas trava ao receber o comando.
 */
export const CUT = [GS, 0x56, 66, 0];

/**
 * GS ( k — QR Code nativo.
 *
 * São quatro comandos em sequência: tamanho do módulo, correção de erro, envio
 * dos dados e impressão. O `pL/pH` do terceiro é o tamanho do payload MAIS 3
 * (os bytes cn, fn e m que vêm depois), em little-endian — é o off-by-one
 * clássico, e é o que quebra QR de PIX, que passa de 255 bytes e usa o pH.
 */
export function qrCode(data: number[], moduleSize: number): number[] {
  const store = data.length + 3;
  return [
    // Tamanho do módulo (1..16 dots por célula).
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x43,
    Math.max(1, Math.min(16, moduleSize)),
    // Nível de correção de erro M (48=L, 49=M, 50=Q, 51=H).
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x45,
    49,
    // Carrega os dados no símbolo.
    GS,
    0x28,
    0x6b,
    store & 0xff,
    (store >> 8) & 0xff,
    0x31,
    0x50,
    0x30,
    ...data,
    // Imprime o que está no símbolo.
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x51,
    0x30,
  ];
}
