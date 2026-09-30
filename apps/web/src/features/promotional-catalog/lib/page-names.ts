// Nomes de página — regras puras, sem React.
//
// Antes: duplicar gerava "Página 1 (cópia) (cópia) (cópia)", e a página que
// virava "Arranjos florais" continuava com esse nome enquanto as geradas saíam
// "Arranjos florais 3". Aqui o nome acompanha o conteúdo.

/** O nome ainda é o que o sistema deu ("Página 3", "Página 1 (cópia)…")? */
export function ehNomePadrao(nome: string): boolean {
  return /^Página \d+( \(cópia\))*$/.test(nome.trim());
}

/** A raiz do nome, sem "(cópia)" nem o número do fim: "Frios 2" → "Frios". */
export function raizDoNome(nome: string): string {
  return nome
    .trim()
    .replace(/(\s*\(cópia\))+$/, "")
    .replace(/\s+\d+$/, "")
    .trim();
}

/**
 * O próximo nome livre da série: "Frios" com "Frios" e "Frios 2" tomados →
 * "Frios 3". Um nome padrão ("Página 1") vira "Página N" com o N livre.
 */
export function proximoNomeLivre(
  ocupados: readonly string[],
  base: string,
): string {
  const raiz = raizDoNome(base) || "Página";
  const tomados = new Set(ocupados.map((n) => n.trim()));
  if (!tomados.has(raiz) && raiz !== "Página") return raiz;
  for (let n = 2; n < 1000; n++) {
    const tentativa = `${raiz} ${n}`;
    if (!tomados.has(tentativa)) return tentativa;
  }
  return `${raiz} ${ocupados.length + 1}`;
}
