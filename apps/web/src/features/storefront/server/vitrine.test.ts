import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ default: {} }));

const { coletarPagina } = await import("./vitrine");

type Linha = { id: string; comFoto: boolean };

/** Um catálogo em memória, paginado pelo id como o cursor do banco faz. */
function catalogo(fotos: boolean[]) {
  const linhas: Linha[] = fotos.map((comFoto, indice) => ({
    id: `p${String(indice).padStart(2, "0")}`,
    comFoto,
  }));
  const lotes: number[] = [];
  const buscarLote = async (take: number, cursor: string | undefined) => {
    const inicio = cursor
      ? linhas.findIndex((linha) => linha.id === cursor) + 1
      : 0;
    lotes.push(take);
    return linhas.slice(inicio, inicio + take);
  };
  const filtrar = async (lote: Linha[]) =>
    lote.filter((linha) => linha.comFoto);
  return { buscarLote, filtrar, lotes };
}

/** Percorre todas as páginas, como o scroll infinito faz. */
async function percorrer(
  fonte: ReturnType<typeof catalogo>,
  quantidade: number,
  maxLotes?: number,
) {
  const paginas: string[][] = [];
  let cursor: string | undefined;
  for (let volta = 0; volta < 50; volta++) {
    const { itens, nextCursor } = await coletarPagina({
      ...fonte,
      quantidade,
      cursor,
      maxLotes,
    });
    paginas.push(itens.map((item) => item.id));
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return paginas;
}

describe("coletarPagina", () => {
  it("pagina sem filtrar nada e encerra no fim do catálogo", async () => {
    const fonte = catalogo(Array(7).fill(true));
    expect(await percorrer(fonte, 3)).toEqual([
      ["p00", "p01", "p02"],
      ["p03", "p04", "p05"],
      ["p06"],
    ]);
  });

  it("não devolve página vazia quando os primeiros produtos não têm foto", async () => {
    // Os 6 primeiros sem foto: cortar no primeiro lote entregaria nada.
    const fonte = catalogo([...Array(6).fill(false), true, true, true]);
    expect(await percorrer(fonte, 2)).toEqual([["p06", "p07"], ["p08"]]);
  });

  it("não repete nem pula produto quando o lote rende mais que a página", async () => {
    const fotos = [true, false, true, true, false, true, true, false, true];
    const fonte = catalogo(fotos);
    const ids = (await percorrer(fonte, 2)).flat();
    const esperados = fotos.flatMap((comFoto, indice) =>
      comFoto ? [`p${String(indice).padStart(2, "0")}`] : [],
    );
    expect(ids).toEqual(esperados);
  });

  it("para no teto de lotes e devolve o cursor para continuar", async () => {
    const fonte = catalogo([...Array(10).fill(false), true]);
    const primeira = await coletarPagina({
      ...fonte,
      quantidade: 2,
      maxLotes: 2,
    });
    expect(primeira.itens).toEqual([]);
    expect(primeira.nextCursor).toBe("p03");
    expect(fonte.lotes).toHaveLength(2);
    // Seguindo o cursor, o produto com foto ainda é encontrado.
    expect((await percorrer(fonte, 2, 2)).flat()).toEqual(["p10"]);
  });

  it("encerra sem cursor quando o último item aprovado fecha a página", async () => {
    const fonte = catalogo([true, false, true]);
    const pagina = await coletarPagina({ ...fonte, quantidade: 2 });
    expect(pagina.itens.map((item) => item.id)).toEqual(["p00", "p02"]);
    expect(pagina.nextCursor).toBeNull();
  });
});
