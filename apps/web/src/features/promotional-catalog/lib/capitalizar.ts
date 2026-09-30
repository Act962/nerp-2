// "Primeira Maiúscula" que funciona com o que vem do cadastro.
//
// O `text-transform: capitalize` do CSS só sobe a primeira letra: "BOX" ficaria
// "BOX" e "Arranjos florais", "Arranjos Florais" — dois títulos com caras
// diferentes no mesmo catálogo. Aqui o texto desce todo e sobe palavra a
// palavra, deixando os conectivos em minúscula (menos na primeira posição).

const CONECTIVOS = new Set([
  "a",
  "as",
  "o",
  "os",
  "e",
  "de",
  "da",
  "das",
  "do",
  "dos",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "com",
  "para",
  "por",
]);

export function capitalizarPalavras(texto: string): string {
  return texto
    .toLocaleLowerCase("pt-BR")
    .split(/(\s+)/)
    .map((parte, indice) => {
      if (/^\s+$/.test(parte) || parte === "") return parte;
      if (indice > 0 && CONECTIVOS.has(parte)) return parte;
      return parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1);
    })
    .join("");
}
