import { describe, expect, it } from "vitest";
import { collectClipboard, countClipboard, pasteIntoPage } from "./clipboard";
import type { CatalogPage } from "../types";

const ov = (id: string, x = 10, y = 20) =>
  ({ id, assetKey: "k", x, y, w: 100, h: 50, rotation: 0 }) as never;
const tx = (id: string, x = 30, y = 40) =>
  ({ id, text: "oi", x, y, w: 200, h: 60, rotation: 0 }) as never;
const grp = (id: string, productIds?: string[]) =>
  ({
    id,
    rect: { x: 0, y: 0, w: 500, h: 400 },
    gridCols: 2,
    gridRows: 2,
    ...(productIds ? { productIds } : {}),
  }) as never;

function page(over: Partial<CatalogPage> = {}): CatalogPage {
  return {
    id: over.id ?? "p1",
    name: "Página",
    locked: false,
    layout: "custom",
    gridCols: 2,
    gridRows: 2,
    overlays: [],
    ...over,
  } as CatalogPage;
}

// Copiar e já garantir que veio algo: evita o "!" espalhado pelos testes.
function copiar(...args: Parameters<typeof collectClipboard>) {
  const data = collectClipboard(...args);
  if (!data) throw new Error("esperava conteúdo copiado");
  return data;
}

// Contador previsível no lugar do uuid — o teste checa que os ids MUDARAM.
const seqId = () => {
  let n = 0;
  return () => `novo-${++n}`;
};

describe("collectClipboard", () => {
  it("leva a seleção primária e a múltipla juntas", () => {
    const pg = page({ overlays: [ov("a"), ov("b")], texts: [tx("t1")] });
    const data = collectClipboard(pg, { kind: "element", id: "a" }, [
      { kind: "overlay", id: "b" },
      { kind: "text", id: "t1" },
    ]);
    expect(data && countClipboard(data)).toBe(3);
  });

  it("sem seleção não copia nada", () => {
    const pg = page({ overlays: [ov("a")] });
    expect(collectClipboard(pg, null, [])).toBeNull();
  });

  it("seleção que não casa com elemento nenhum devolve nulo", () => {
    // Selecionar o fundo não é copiar o fundo.
    const pg = page({ overlays: [ov("a")] });
    expect(collectClipboard(pg, { kind: "background" }, [])).toBeNull();
  });

  it("guarda o OBJETO, não o id", () => {
    // Mexer no original depois de copiar não pode mudar o que será colado.
    const original = ov("a", 10, 20) as unknown as { x: number };
    const pg = page({ overlays: [original as never] });
    const data = copiar(pg, { kind: "element", id: "a" }, []);
    original.x = 999;
    expect(data.overlays[0].x).toBe(10);
  });
});

describe("pasteIntoPage", () => {
  const origem = page({ id: "p1", overlays: [ov("a", 10, 20)] });
  const destino = page({ id: "p2" });
  const data = copiar(origem, { kind: "element", id: "a" }, []);

  it("cola em OUTRA página na mesma posição", () => {
    // Posição preservada é o que permite repetir um selo no mesmo canto de
    // todas as páginas.
    const r = pasteIntoPage({
      pages: [origem, destino],
      index: 1,
      data,
      frozenProductIds: [[], []],
      newId: seqId(),
      offset: 24,
    });
    expect(r.pages[1].overlays).toHaveLength(1);
    expect(r.pages[1].overlays[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("cola na MESMA página deslocado, senão some atrás do original", () => {
    const r = pasteIntoPage({
      pages: [origem],
      index: 0,
      data,
      frozenProductIds: [[]],
      newId: seqId(),
      offset: 24,
    });
    expect(r.pages[0].overlays).toHaveLength(2);
    expect(r.pages[0].overlays[1]).toMatchObject({ x: 34, y: 44 });
  });

  it("o colado sempre ganha id NOVO", () => {
    // Id repetido faz a camada de seleção editar o elemento da outra página.
    const r = pasteIntoPage({
      pages: [origem, destino],
      index: 1,
      data,
      frozenProductIds: [[], []],
      newId: seqId(),
      offset: 24,
    });
    expect(r.pages[1].overlays[0].id).not.toBe("a");
  });

  it("não toca na página de origem", () => {
    const r = pasteIntoPage({
      pages: [origem, destino],
      index: 1,
      data,
      frozenProductIds: [[], []],
      newId: seqId(),
      offset: 24,
    });
    expect(r.pages[0].overlays).toHaveLength(1);
  });
});

describe("pasteIntoPage com grupo de produtos", () => {
  const origem = page({ id: "p1", productGroups: [grp("g1", ["x", "y"])] });
  const destino = page({ id: "p2" });
  const data = copiar(origem, { kind: "group", id: "g1" }, []);

  it("leva os produtos do grupo para a página de destino", () => {
    // Sem isto o grupo colado desenharia vazio.
    const r = pasteIntoPage({
      pages: [origem, destino],
      index: 1,
      data,
      frozenProductIds: [["a", "b"], ["c"]],
      newId: seqId(),
    });
    expect(r.pastedProductIds).toEqual(["x", "y"]);
    expect(r.pages[1].productIds).toEqual(["c", "x", "y"]);
  });

  it("CONGELA as outras páginas antes de fixar produtos", () => {
    // Fixar `productIds` numa página liga o modo explícito do catálogo inteiro;
    // sem congelar, os produtos das demais pulariam de página.
    const r = pasteIntoPage({
      pages: [origem, destino],
      index: 1,
      data,
      frozenProductIds: [["a", "b"], ["c"]],
      newId: seqId(),
    });
    expect(r.pages[0].productIds).toEqual(["a", "b"]);
  });

  it("grupo colado recebe id novo", () => {
    const r = pasteIntoPage({
      pages: [origem, destino],
      index: 1,
      data,
      frozenProductIds: [[], []],
      newId: seqId(),
    });
    expect(r.pages[1].productGroups?.[0].id).not.toBe("g1");
  });

  it("colar SÓ elemento não congela página nenhuma", () => {
    // Congelar sem necessidade fixaria a distribuição de todo o catálogo por
    // causa de um texto colado.
    const comTexto = page({ id: "p1", texts: [tx("t1")] });
    const d = copiar(comTexto, { kind: "text", id: "t1" }, []);
    const r = pasteIntoPage({
      pages: [comTexto, destino],
      index: 1,
      data: d,
      frozenProductIds: [["a"], ["b"]],
      newId: seqId(),
    });
    expect(r.pages[0].productIds).toBeUndefined();
    expect(r.pages[1].productIds).toBeUndefined();
  });
});
