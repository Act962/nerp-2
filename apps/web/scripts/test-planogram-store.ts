import { createPlanogramStore } from "@/features/planogram/engine/planogram-store";
import { FIXTURE_PRESETS_BY_ID } from "@/features/planogram/engine/fixture-presets";
import type {
  PlanogramScene,
  ProductRef,
} from "@/features/planogram/engine/types";

let pass = 0,
  fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(
    `${ok ? "  ok " : "  XX "} ${name}${ok ? "" : `\n       obtido=${JSON.stringify(got)}\n       esperado=${JSON.stringify(want)}`}`,
  );
  ok ? pass++ : fail++;
}

const emptyScene: PlanogramScene = {
  meta: {
    id: "pg1",
    name: "Teste",
    status: "RASCUNHO",
    isActive: false,
    currentVersion: 1,
    categoryId: null,
  },
  fixtures: [],
  modules: [],
  shelves: [],
  items: [],
  products: [],
};
const product = (id: string): ProductRef => ({
  id,
  name: `Produto ${id}`,
  barcode: null,
  thumbnail: null,
  brandId: "b1",
  brandName: "OMO",
  categoryId: "c1",
  supplierId: null,
  widthMm: 100,
  heightMm: 200,
  depthMm: 80,
  packWidthMm: null,
  packHeightMm: null,
  packDepthMm: null,
});
const preset = FIXTURE_PRESETS_BY_ID.get("gondola-1300x1900");
if (!preset) throw new Error("Preset gondola-1300x1900 não existe mais");

console.log("\n— criar gôndola —");
const store = createPlanogramStore(emptyScene);
store.getState().addFixture(preset, "Limpeza");
let s = store.getState();
check("1 gôndola", Object.keys(s.fixtures).length, 1);
check("1 módulo", Object.keys(s.modules).length, 1);
check("5 prateleiras", Object.keys(s.shelves).length, 5);

const shelfIds = s.order.shelvesByModule[Object.keys(s.modules)[0]];
const shelfId = shelfIds[0];

console.log("\n— posicionar 3 produtos —");
store.getState().addItem(shelfId, product("p1"));
store.getState().addItem(shelfId, product("p2"));
store.getState().addItem(shelfId, product("p3"));
s = store.getState();
check("3 itens", Object.keys(s.items).length, 3);
check("ordem na prateleira", s.order.itemsByShelf[shelfId].length, 3);
check(
  "positions contíguas",
  s.order.itemsByShelf[shelfId].map((id) => s.items[id].position),
  [0, 1, 2],
);

console.log("\n— O TESTE QUE IMPORTA: undo suja só o que mudou —");
// Zera a fila simulando um save bem-sucedido.
const all = store.getState().collectDirty();
store.getState().commitClean(all.upserts, all.deletes);
check("fila limpa após save", store.getState().dirty.size, 0);

const itemIds = store.getState().order.itemsByShelf[shelfId];
const targetItem = itemIds[1];
store.getState().setItemFacings(targetItem, 4);
check("editar 1 item suja 1 entidade", store.getState().dirty.size, 1);
check(
  "e é o item certo",
  [...store.getState().dirty.keys()],
  [`item:${targetItem}`],
);

store.getState().undo();
check(
  "UNDO suja só 1 entidade (store-map sujaria a cena toda)",
  store.getState().dirty.size,
  1,
);
check("frentes voltaram a 1", store.getState().items[targetItem].facings, 1);
store.getState().redo();
check("REDO reaplica", store.getState().items[targetItem].facings, 4);

console.log("\n— autosave: collectDirty NÃO limpa —");
const collected = store.getState().collectDirty();
check("coletou 1", collected.upserts.length, 1);
check("continua sujo após coletar", store.getState().dirty.size, 1);

console.log("\n— autosave: edição durante o voo não se perde —");
// Simula: coletou, e o usuário editou de novo ANTES da resposta chegar.
store.getState().setItemFacings(targetItem, 7);
store.getState().commitClean(collected.upserts, collected.deletes);
check(
  "segue sujo (geração mudou durante o voo)",
  store.getState().dirty.size,
  1,
);
check("valor novo preservado", store.getState().items[targetItem].facings, 7);
// Agora um save que reflete o estado atual limpa de verdade.
const fresh = store.getState().collectDirty();
store.getState().commitClean(fresh.upserts, fresh.deletes);
check("save atualizado limpa", store.getState().dirty.size, 0);

console.log("\n— remover prateleira não descarta itens em silêncio —");
store.getState().removeShelf(shelfId);
s = store.getState();
check("prateleira sumiu", s.shelves[shelfId], undefined);
check("itens viraram não posicionados", s.unplacedItemIds.length, 3);
check("itens continuam existindo", Object.keys(s.items).length, 3);
check("delete enfileirado", s.deleted.has(`shelf:${shelfId}`), true);

console.log("\n— módulo novo copia as prateleiras do anterior —");
const store2 = createPlanogramStore(emptyScene);
store2.getState().addFixture(preset, "Bebidas");
const fixtureId = store2.getState().order.fixtures[0];
store2.getState().addModule(fixtureId);
const s2 = store2.getState();
check("2 módulos", s2.order.modulesByFixture[fixtureId].length, 2);
const [mod1, mod2] = s2.order.modulesByFixture[fixtureId];
check(
  "mesmo número de prateleiras",
  s2.order.shelvesByModule[mod2].length,
  s2.order.shelvesByModule[mod1].length,
);
check(
  "mesmas alturas",
  s2.order.shelvesByModule[mod2].map((id) => s2.shelves[id].yMm),
  s2.order.shelvesByModule[mod1].map((id) => s2.shelves[id].yMm),
);

console.log("\n— prateleira não cruza a vizinha —");
const store3 = createPlanogramStore(emptyScene);
store3.getState().addFixture(preset, "Teste");
const s3ids =
  store3.getState().order.shelvesByModule[
    Object.keys(store3.getState().modules)[0]
  ];
const lower = store3.getState().shelves[s3ids[0]].yMm;
store3.getState().moveShelfY(s3ids[1], lower - 500); // tenta atravessar a de baixo
check(
  "travou acima da de baixo",
  store3.getState().shelves[s3ids[1]].yMm >= lower + 50,
  true,
);

console.log(
  `\n${fail === 0 ? "TODOS PASSARAM" : "FALHAS"}: ${pass} ok, ${fail} falhas`,
);
process.exit(fail === 0 ? 0 : 1);
