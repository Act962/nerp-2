import {
  packShelf,
  itemWidthMm,
  shelfClearanceMm,
  shelfOccupancyPct,
  insertIndexAt,
  reorderPositions,
  linearMmOfItems,
} from "@/features/planogram/engine/packing";
import {
  buildShelvesForFixture,
  FIXTURE_PRESETS_BY_ID,
} from "@/features/planogram/engine/fixture-presets";
import type { ItemNode, ShelfNode } from "@/features/planogram/engine/types";

let pass = 0,
  fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(
    `${ok ? "  ok " : "  XX "} ${name}${ok ? "" : `\n       obtido=${JSON.stringify(got)}\n       esperado=${JSON.stringify(want)}`}`,
  );
  ok ? pass++ : fail++;
}

const shelf = (over: Partial<ShelfNode> = {}): ShelfNode => ({
  id: "s1",
  moduleId: "m1",
  index: 0,
  yMm: 400,
  widthMm: 1300,
  depthMm: 400,
  thicknessMm: 25,
  kind: "PRATELEIRA",
  layoutMode: "PACKED",
  maxWeightKg: null,
  colorHex: null,
  dividers: [],
  ...over,
});
const item = (id: string, over: Partial<ItemNode> = {}): ItemNode => ({
  id,
  shelfId: "s1",
  productId: `p-${id}`,
  position: 0,
  xMm: null,
  facings: 1,
  facingsDeep: 1,
  facingsHigh: 1,
  orientation: "FRENTE",
  isBoxed: false,
  widthMm: 100,
  heightMm: 200,
  depthMm: 80,
  note: null,
  ...over,
});

console.log("\n— largura por frentes —");
check("1 frente de 100mm", itemWidthMm(item("a")), 100);
check("4 frentes de 100mm", itemWidthMm(item("a", { facings: 4 })), 400);
check("0 frentes não vira negativo", itemWidthMm(item("a", { facings: 0 })), 0);

console.log("\n— prateleira vazia —");
const empty = packShelf(shelf(), []);
check("usado", empty.usedMm, 0);
check("livre", empty.freeMm, 1300);
check("transbordo", empty.overflowMm, 0);

console.log("\n— soma EXATA da largura (não pode acusar transbordo) —");
const exact = packShelf(shelf({ widthMm: 400 }), [
  item("a", { position: 0, facings: 2 }),
  item("b", { position: 1, facings: 2 }),
]);
check("usado", exact.usedMm, 400);
check("livre", exact.freeMm, 0);
check("transbordo", exact.overflowMm, 0);
check("nenhum item marcado", exact.overflowItemIds, []);

console.log("\n— transbordo por 1mm —");
const over = packShelf(shelf({ widthMm: 399 }), [
  item("a", { position: 0, facings: 2 }),
  item("b", { position: 1, facings: 2 }),
]);
check("transbordo", over.overflowMm, 1);
check("item que estoura", over.overflowItemIds, ["b"]);

console.log("\n— item mais largo que a prateleira inteira —");
const huge = packShelf(shelf({ widthMm: 300 }), [item("a", { widthMm: 500 })]);
check("transbordo", huge.overflowMm, 200);
check("marcado", huge.overflowItemIds, ["a"]);

console.log("\n— ordem respeita position, não a ordem do array —");
const ordered = packShelf(shelf(), [
  item("c", { position: 2 }),
  item("a", { position: 0 }),
  item("b", { position: 1 }),
]);
check(
  "sequência",
  ordered.placements.map((p) => p.itemId),
  ["a", "b", "c"],
);
check(
  "x acumulado",
  ordered.placements.map((p) => p.xMm),
  [0, 100, 200],
);

console.log("\n— altura: empilhamento e vão livre —");
const shelves = [
  shelf({ id: "s1", index: 0, yMm: 400 }),
  shelf({ id: "s2", index: 1, yMm: 800 }),
];
check(
  "vão entre prateleiras",
  shelfClearanceMm(shelves[0], shelves, 1900),
  375,
);
check(
  "vão da última até o topo",
  shelfClearanceMm(shelves[1], shelves, 1900),
  1100,
);
const tall = packShelf(shelf(), [item("a", { heightMm: 400 })], {
  clearanceMm: 375,
});
check("item alto demais", tall.tooTallItemIds, ["a"]);
const stacked = packShelf(
  shelf(),
  [item("a", { heightMm: 200, facingsHigh: 2 })],
  { clearanceMm: 375 },
);
check("empilhado estoura o vão", stacked.tooTallItemIds, ["a"]);

console.log("\n— profundidade —");
const deep = packShelf(shelf({ depthMm: 400 }), [
  item("a", { depthMm: 150, facingsDeep: 3 }),
]);
check("fundo demais", deep.tooDeepItemIds, ["a"]);

console.log("\n— modo FREE: usa xMm e a borda mais à direita —");
const free = packShelf(shelf({ layoutMode: "FREE" }), [
  item("a", { xMm: 500 }),
  item("b", { xMm: 0 }),
]);
check(
  "ordena por x",
  free.placements.map((p) => p.itemId),
  ["b", "a"],
);
check("usado = borda direita, não soma", free.usedMm, 600);

console.log("\n— índice de inserção pelo ponto médio —");
const three = [
  item("a", { position: 0 }),
  item("b", { position: 1 }),
  item("c", { position: 2 }),
];
check("antes de tudo", insertIndexAt(shelf(), three, 10), 0);
check("metade direita do 1º", insertIndexAt(shelf(), three, 60), 1);
check("depois de tudo", insertIndexAt(shelf(), three, 1200), 3);

console.log("\n— reordenar devolve só quem mudou —");
check("mover 'a' para o fim", reorderPositions(three, "a", 2), [
  { id: "b", position: 0 },
  { id: "c", position: 1 },
  { id: "a", position: 2 },
]);
check("mover para onde já está = nada", reorderPositions(three, "a", 0), []);

console.log("\n— ocupação e linear —");
check(
  "50% de 1300",
  shelfOccupancyPct(shelf({ widthMm: 1000 }), [item("a", { facings: 5 })]),
  50,
);
check(
  "linear de itens",
  linearMmOfItems([item("a", { facings: 3 }), item("b", { facings: 2 })]),
  500,
);

console.log("\n— preset: base mais alta e mais funda —");
const preset = FIXTURE_PRESETS_BY_ID.get("gondola-1300x1900");
if (!preset) throw new Error("Preset gondola-1300x1900 não existe mais");
const built = buildShelvesForFixture(preset, "m1");
check("quantidade", built.length, 5);
check("base mais funda", built[0].depthMm, 600);
check("demais na profundidade padrão", built[1].depthMm, 400);
const gaps = built.map((s, i) =>
  i === 0 ? s.yMm - preset.baseHeightMm : s.yMm - built[i - 1].yMm,
);
console.log(`       vãos (mm): ${gaps.join(", ")}`);
check("base tem o maior vão", gaps[0] > gaps[1], true);
check(
  "última não passa do topo",
  built[built.length - 1].yMm <= preset.heightMm,
  true,
);

console.log(
  `\n${fail === 0 ? "TODOS PASSARAM" : "FALHAS"}: ${pass} ok, ${fail} falhas`,
);
process.exit(fail === 0 ? 0 : 1);
