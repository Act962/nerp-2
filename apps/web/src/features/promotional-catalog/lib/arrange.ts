// Alinhamento e distribuição de elementos na página — lógica pura.
//
// Trabalha em px do canvas 1080×pageH, o mesmo espaço de overlays, textos e
// blocos de estilo. Não sabe de React nem de config: recebe caixas, devolve as
// novas posições. É o que permite testar sem montar o editor.

export type Box = { id: string; x: number; y: number; w: number; h: number };

export type AlignMode =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "center-v"
  | "bottom";

/**
 * Alinha as caixas.
 *
 * Com UMA caixa, a referência é a PÁGINA (centralizar na página é o uso mais
 * comum). Com duas ou mais, a referência é a caixa envolvente da seleção — que
 * é como qualquer editor se comporta: alinhar não deve arrastar tudo para a
 * borda da página.
 */
export function alignBoxes(
  boxes: readonly Box[],
  mode: AlignMode,
  page: { w: number; h: number },
): Box[] {
  if (boxes.length === 0) return [];
  const usarPagina = boxes.length === 1;
  const minX = usarPagina ? 0 : Math.min(...boxes.map((b) => b.x));
  const minY = usarPagina ? 0 : Math.min(...boxes.map((b) => b.y));
  const maxX = usarPagina ? page.w : Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = usarPagina ? page.h : Math.max(...boxes.map((b) => b.y + b.h));

  return boxes.map((b) => {
    switch (mode) {
      case "left":
        return { ...b, x: Math.round(minX) };
      case "right":
        return { ...b, x: Math.round(maxX - b.w) };
      case "center-h":
        return { ...b, x: Math.round((minX + maxX) / 2 - b.w / 2) };
      case "top":
        return { ...b, y: Math.round(minY) };
      case "bottom":
        return { ...b, y: Math.round(maxY - b.h) };
      case "center-v":
        return { ...b, y: Math.round((minY + maxY) / 2 - b.h / 2) };
      default:
        return b;
    }
  });
}

/**
 * Distribui o ESPAÇO entre as caixas por igual, no eixo pedido.
 *
 * As duas das pontas não se movem — elas definem o intervalo. Distribui o vão
 * livre, não os centros: com elementos de tamanhos diferentes, espaçar centros
 * deixa os intervalos visualmente desiguais.
 *
 * Menos de 3 caixas não têm o que distribuir.
 */
export function distributeBoxes(boxes: readonly Box[], axis: "h" | "v"): Box[] {
  if (boxes.length < 3) return [...boxes];
  const pos = (b: Box) => (axis === "h" ? b.x : b.y);
  const size = (b: Box) => (axis === "h" ? b.w : b.h);

  const ordenadas = [...boxes].sort((a, b) => pos(a) - pos(b));
  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  const inicio = pos(primeira) + size(primeira);
  const fim = pos(ultima);
  const ocupado = ordenadas.slice(1, -1).reduce((soma, b) => soma + size(b), 0);
  const vao = (fim - inicio - ocupado) / (ordenadas.length - 1);

  let cursor = inicio;
  const porId = new Map<string, Box>();
  ordenadas.slice(1, -1).forEach((b) => {
    cursor += vao;
    porId.set(b.id, {
      ...b,
      ...(axis === "h" ? { x: Math.round(cursor) } : { y: Math.round(cursor) }),
    });
    cursor += size(b);
  });

  // Devolve na ordem original — quem chamou casa por id, mas manter a ordem
  // evita surpresa se alguém usar o índice.
  return boxes.map((b) => porId.get(b.id) ?? b);
}
