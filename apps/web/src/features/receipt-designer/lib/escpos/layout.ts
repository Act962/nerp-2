// Composição de texto em COLUNAS.
//
// A térmica é monoespaçada e não sabe alinhar nada: "R$ 12,00 à direita" é o
// programa contando caracteres e enchendo o meio de espaço. Tudo aqui conta
// CARACTERES, nunca bytes — "Açaí" ocupa 4 colunas, mesmo que vire 4 bytes com
// acento alto ou 6 se caísse em UTF-8.

/** Corta o que não cabe. Nome de produto longo não pode empurrar o preço. */
export function truncate(text: string, cols: number): string {
  const chars = [...text];
  return chars.length <= cols ? text : chars.slice(0, cols).join("");
}

export function padRight(text: string, cols: number): string {
  const chars = [...text];
  return chars.length >= cols ? text : text + " ".repeat(cols - chars.length);
}

export function center(text: string, cols: number): string {
  const chars = [...truncate(text, cols)];
  const left = Math.floor((cols - chars.length) / 2);
  return " ".repeat(Math.max(0, left)) + chars.join("");
}

export function alignLine(
  text: string,
  cols: number,
  to: "left" | "center" | "right",
): string {
  if (to === "center") return center(text, cols);
  if (to === "right") {
    const cut = truncate(text, cols);
    return " ".repeat(Math.max(0, cols - [...cut].length)) + cut;
  }
  return truncate(text, cols);
}

/**
 * Duas colunas: rótulo à esquerda, valor à direita, preenchendo a linha exata.
 *
 * O valor é sagrado — se faltar espaço, quem encolhe é o rótulo. Um preço
 * cortado no cupom é reclamação no balcão.
 */
export function twoCols(left: string, right: string, cols: number): string {
  const rightChars = [...right];
  if (rightChars.length >= cols) return rightChars.slice(0, cols).join("");

  const room = cols - rightChars.length;
  // Ao menos um espaço separando, quando há o que separar.
  const leftCut = truncate(left, Math.max(0, room - 1));
  return padRight(leftCut, room) + right;
}

/** Quebra em várias linhas respeitando a palavra, quando dá. */
export function wrap(text: string, cols: number): string[] {
  const linhas: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      linhas.push("");
      continue;
    }

    let atual = "";
    for (const word of paragraph.split(" ")) {
      const candidate = atual ? `${atual} ${word}` : word;
      if ([...candidate].length <= cols) {
        atual = candidate;
        continue;
      }
      if (atual) linhas.push(atual);
      // Palavra sozinha maior que a linha: parte no seco, senão some.
      let resto = word;
      while ([...resto].length > cols) {
        linhas.push([...resto].slice(0, cols).join(""));
        resto = [...resto].slice(cols).join("");
      }
      atual = resto;
    }
    linhas.push(atual);
  }

  return linhas;
}

export function repeat(char: string, cols: number): string {
  return char.repeat(cols);
}
