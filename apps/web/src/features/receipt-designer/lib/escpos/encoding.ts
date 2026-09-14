// Texto → bytes na tabela de caracteres da impressora.
//
// Mandar UTF-8 cru é o erro nº 1 de quem imprime em térmica: a impressora lê
// byte a byte contra uma tabela de 256 posições e devolve "AÃ§aÃ­" em vez de
// "Açaí". Aqui a acentuação vira o byte certo da tabela escolhida; o que não
// existe na tabela vira "?" — nunca um byte solto, que a impressora
// interpretaria como comando.

export type Codepage = "CP437" | "CP850" | "CP860";

/**
 * Só os caracteres que o português usa, mais os símbolos que aparecem em
 * cupom. A tabela completa tem 128 posições por codepage; mapear tudo seria
 * ruído — o que falta cai no ASCII ou no "?".
 */
const HIGH_CHARS: Record<Codepage, Record<string, number>> = {
  CP437: {
    ç: 0x87,
    Ç: 0x80,
    á: 0xa0,
    é: 0x82,
    í: 0xa1,
    ó: 0xa2,
    ú: 0xa3,
    â: 0x83,
    ê: 0x88,
    î: 0x8c,
    ô: 0x93,
    û: 0x96,
    à: 0x85,
    ã: 0x61,
    õ: 0x6f,
    ä: 0x84,
    ë: 0x89,
    ï: 0x8b,
    ö: 0x94,
    ü: 0x81,
    Á: 0x41,
    É: 0x90,
    Í: 0x49,
    Ó: 0x4f,
    Ú: 0x55,
    ñ: 0xa4,
    Ñ: 0xa5,
    º: 0xa7,
    ª: 0xa6,
    "°": 0xf8,
    "²": 0xfd,
    "·": 0xfa,
  },
  CP850: {
    ç: 0x87,
    Ç: 0x80,
    á: 0xa0,
    é: 0x82,
    í: 0xa1,
    ó: 0xa2,
    ú: 0xa3,
    â: 0x83,
    ê: 0x88,
    î: 0x8c,
    ô: 0x93,
    û: 0x96,
    à: 0x85,
    è: 0x8a,
    ì: 0x8d,
    ò: 0x95,
    ù: 0x97,
    ã: 0xc6,
    õ: 0xe4,
    Ã: 0xc7,
    Õ: 0xe5,
    ä: 0x84,
    ë: 0x89,
    ï: 0x8b,
    ö: 0x94,
    ü: 0x81,
    Á: 0xb5,
    É: 0x90,
    Í: 0xd6,
    Ó: 0xe0,
    Ú: 0xe9,
    Â: 0xb6,
    Ê: 0xd2,
    Ô: 0xe2,
    À: 0xb7,
    ñ: 0xa4,
    Ñ: 0xa5,
    º: 0xa7,
    ª: 0xa6,
    "°": 0xf8,
    "²": 0xfd,
    "·": 0xfa,
  },
  CP860: {
    // A tabela portuguesa: é a que tem Ã e Õ em posição própria.
    Ç: 0x80,
    ü: 0x81,
    é: 0x82,
    â: 0x83,
    ã: 0x84,
    à: 0x85,
    Á: 0x86,
    ç: 0x87,
    ê: 0x88,
    Ê: 0x89,
    è: 0x8a,
    Í: 0x8b,
    Ô: 0x8c,
    ì: 0x8d,
    Ã: 0x8e,
    Â: 0x8f,
    É: 0x90,
    À: 0x91,
    È: 0x92,
    ô: 0x93,
    õ: 0x94,
    ò: 0x95,
    Ú: 0x96,
    ù: 0x97,
    Ì: 0x98,
    Õ: 0x99,
    ó: 0xa2,
    ú: 0xa3,
    ñ: 0xa4,
    Ñ: 0xa5,
    ª: 0xa6,
    º: 0xa7,
    á: 0xa0,
    í: 0xa1,
    Ó: 0x9f,
    "°": 0xf8,
    "²": 0xfd,
    "·": 0xfa,
  },
};

/**
 * Último recurso: tira o acento (ou troca o símbolo tipográfico) em vez de
 * imprimir "?". Aspas curvas e travessão chegam de texto colado pelo usuário e
 * não existem em tabela de térmica nenhuma.
 */
const FALLBACK_ASCII: Record<string, string> = {
  á: "a",
  à: "a",
  ã: "a",
  â: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  õ: "o",
  ô: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
  ñ: "n",
  Á: "A",
  À: "A",
  Ã: "A",
  Â: "A",
  Ä: "A",
  É: "E",
  È: "E",
  Ê: "E",
  Ë: "E",
  Í: "I",
  Ì: "I",
  Î: "I",
  Ï: "I",
  Ó: "O",
  Ò: "O",
  Õ: "O",
  Ô: "O",
  Ö: "O",
  Ú: "U",
  Ù: "U",
  Û: "U",
  Ü: "U",
  Ç: "C",
  Ñ: "N",
  º: "o",
  ª: "a",
  "°": "o",
  "–": "-",
  "—": "-",
  "…": "...",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "«": "<<",
  "»": ">>",
};

/** Espaço não separável, espaço fino e afins. */
const ESPACOS = new Set([0x00a0, 0x2007, 0x2009, 0x202f, 0x2060, 0xfeff]);

export function encodeText(text: string, codepage: Codepage): number[] {
  const table = HIGH_CHARS[codepage];
  const bytes: number[] = [];

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0x3f;

    if (code === 0x0a) {
      bytes.push(0x0a);
      continue;
    }

    // ASCII imprimível passa direto em qualquer tabela.
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
      continue;
    }

    // Espaços "especiais" viram espaço comum. O formatador de moeda do pt-BR
    // devolve um espaço não separável depois do símbolo, e sem isto todo valor
    // do cupom sairia com um "?" na frente do preço.
    if (ESPACOS.has(code)) {
      bytes.push(0x20);
      continue;
    }

    const mapped = table[char];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }

    const ascii = FALLBACK_ASCII[char];
    if (ascii) {
      bytes.push(...[...ascii].map((c) => c.charCodeAt(0)));
      continue;
    }

    bytes.push(0x3f); // "?"
  }

  return bytes;
}
