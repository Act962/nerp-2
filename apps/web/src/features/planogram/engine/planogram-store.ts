"use client";

import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch,
} from "immer";
import { createStore } from "zustand/vanilla";
import {
  buildShelvesForFixture,
  type FixturePreset,
  TOP_CLEARANCE_MM,
} from "./fixture-presets";
import { insertIndexAt, reorderPositions } from "./packing";
import type {
  ColorBy,
  FixtureNode,
  ItemNode,
  ModuleNode,
  PlanogramMeta,
  PlanogramScene,
  FixtureTemplate,
  ProductRef,
  ShelfNode,
} from "./types";
import { clampMm, snapMm } from "./units";

enablePatches();

const HISTORY_LIMIT = 100;

export type EntityKind = "fixture" | "module" | "shelf" | "item";
export type EntityKey = `${EntityKind}:${string}`;

export interface Selection {
  kind: EntityKind | null;
  ids: string[];
}

export interface ViewState {
  zoomLevel: number;
  showColors: boolean;
  showEans: boolean;
  showList: boolean;
  showBackground: boolean;
  colorBy: ColorBy;
}

interface Transaction {
  patches: Patch[];
  inverse: Patch[];
  touched: EntityKey[];
}

export interface PlanogramState {
  meta: PlanogramMeta;
  fixtures: Record<string, FixtureNode>;
  modules: Record<string, ModuleNode>;
  shelves: Record<string, ShelfNode>;
  items: Record<string, ItemNode>;
  products: Record<string, ProductRef>;

  order: {
    fixtures: string[];
    modulesByFixture: Record<string, string[]>;
    shelvesByModule: Record<string, string[]>;
    itemsByShelf: Record<string, string[]>;
  };

  selection: Selection;
  activeFixtureId: string | null;
  activeModuleIndex: number;
  view: ViewState;
  /** Itens que perderam a prateleira (ex.: prateleira removida). */
  unplacedItemIds: string[];

  // Fila de persistência. `dirty` guarda a GERAÇÃO de cada entidade: se o
  // usuário editar de novo enquanto um save está em voo, a geração muda e o
  // autosave sabe que não pode marcar como limpo.
  dirty: Map<EntityKey, number>;
  deleted: Set<EntityKey>;
  generation: number;

  past: Transaction[];
  future: Transaction[];
}

export interface PlanogramActions {
  setSelection: (kind: EntityKind | null, ids: string[]) => void;
  setView: (patch: Partial<ViewState>) => void;
  setActiveModuleIndex: (index: number) => void;
  setActiveFixture: (fixtureId: string) => void;
  /** Atualiza o cadastro do produto (medida, foto) já carregado na cena. */
  setProductRef: (product: ProductRef) => void;

  addFixture: (preset: FixturePreset, name: string) => void;
  /** Recria a gôndola de um padrão salvo, com os níveis nas alturas gravadas. */
  addFixtureFromTemplate: (template: FixtureTemplate, name: string) => void;
  updateFixture: (id: string, patch: Partial<FixtureNode>) => void;
  /** Altera a altura da estrutura reassentando as prateleiras que ficariam de fora. */
  setFixtureHeight: (id: string, heightMm: number) => void;
  removeFixture: (id: string) => void;

  addModule: (fixtureId: string) => void;
  removeModule: (moduleId: string) => void;

  addShelf: (moduleId: string) => void;
  duplicateShelf: (sourceId: string) => void;
  updateShelf: (id: string, patch: Partial<ShelfNode>) => void;
  /** Devolve o yMm final já travado entre as vizinhas. */
  moveShelfY: (id: string, yMm: number) => number;
  removeShelf: (id: string) => void;

  addItem: (
    shelfId: string,
    product: ProductRef,
    options?: { dropXMm?: number; facings?: number },
  ) => void;
  updateItem: (id: string, patch: Partial<ItemNode>) => void;
  setItemFacings: (id: string, facings: number) => void;
  moveItem: (id: string, toShelfId: string, dropXMm: number) => void;
  removeItem: (id: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Devolve o payload sujo SEM limpar — quem limpa é o commitClean. */
  collectDirty: () => {
    upserts: { kind: EntityKind; id: string; generation: number }[];
    deletes: EntityKey[];
  };
  /** Limpa só o que não mudou de geração durante o voo do save. */
  commitClean: (
    consumed: { kind: EntityKind; id: string; generation: number }[],
    deletes: EntityKey[],
  ) => void;
  hasPendingChanges: () => boolean;
}

export type PlanogramStore = ReturnType<typeof createPlanogramStore>;

const uid = () => crypto.randomUUID();

function buildOrder(scene: PlanogramScene): PlanogramState["order"] {
  const modulesByFixture: Record<string, string[]> = {};
  const shelvesByModule: Record<string, string[]> = {};
  const itemsByShelf: Record<string, string[]> = {};

  function pushInto(
    bucket: Record<string, string[]>,
    key: string,
    value: string,
  ) {
    if (!bucket[key]) bucket[key] = [];
    bucket[key].push(value);
  }

  for (const moduleNode of [...scene.modules].sort(
    (a, b) => a.index - b.index,
  )) {
    pushInto(modulesByFixture, moduleNode.fixtureId, moduleNode.id);
  }
  for (const shelf of [...scene.shelves].sort((a, b) => a.index - b.index)) {
    pushInto(shelvesByModule, shelf.moduleId, shelf.id);
  }
  for (const item of [...scene.items].sort((a, b) => a.position - b.position)) {
    pushInto(itemsByShelf, item.shelfId, item.id);
  }

  return {
    fixtures: [...scene.fixtures]
      .sort((a, b) => a.order - b.order)
      .map((fixture) => fixture.id),
    modulesByFixture,
    shelvesByModule,
    itemsByShelf,
  };
}

function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((entry) => [entry.id, entry]));
}

/**
 * Store criado por instância e exposto via Context — NUNCA singleton de módulo.
 * O `scene-store` do store-map é criado no escopo do módulo, e por isso dois
 * editores na mesma página compartilham estado (há inclusive um workaround lá
 * para vazamento entre lojas). Aqui isso não pode acontecer: comparar duas
 * versões lado a lado é caso de uso previsto.
 */
export function createPlanogramStore(scene: PlanogramScene) {
  return createStore<PlanogramState & PlanogramActions>()((set, get) => {
    /**
     * Toda mutação passa por aqui. `produceWithPatches` devolve os patches e os
     * inversos — e os caminhos dos patches SÃO a lista de sujos, então undo,
     * redo e dirty-tracking saem do mesmo mecanismo.
     *
     * É a diferença central para o `scene-store`, que faz `markAll` no undo e
     * reenviaria a cena inteira a cada Ctrl+Z.
     */
    function commit(recipe: (draft: PlanogramState) => void) {
      const state = get();
      const [next, patches, inverse] = produceWithPatches(state, recipe);
      if (patches.length === 0) return;

      const touched = collectTouched(patches);
      const generation = state.generation + 1;
      const dirty = new Map(state.dirty);
      for (const key of touched) dirty.set(key, generation);

      set({
        ...(next as PlanogramState),
        dirty,
        generation,
        past: [...state.past, { patches, inverse, touched }].slice(
          -HISTORY_LIMIT,
        ),
        future: [],
      });
    }

    return {
      meta: scene.meta,
      fixtures: byId(scene.fixtures),
      modules: byId(scene.modules),
      shelves: byId(scene.shelves),
      items: byId(scene.items),
      products: byId(scene.products),
      order: buildOrder(scene),

      selection: { kind: null, ids: [] },
      activeFixtureId: scene.fixtures[0]?.id ?? null,
      activeModuleIndex: 0,
      view: {
        zoomLevel: 1,
        showColors: false,
        showEans: false,
        showList: true,
        showBackground: true,
        colorBy: "BRAND",
      },
      unplacedItemIds: [],

      dirty: new Map(),
      deleted: new Set(),
      generation: 0,
      past: [],
      future: [],

      // ── seleção e visualização (não entram no histórico) ──────────────────
      setSelection: (kind, ids) => set({ selection: { kind, ids } }),
      setView: (patch) => set({ view: { ...get().view, ...patch } }),
      setActiveModuleIndex: (index) => set({ activeModuleIndex: index }),
      setActiveFixture: (fixtureId) => {
        if (!get().fixtures[fixtureId]) return;
        set({ activeFixtureId: fixtureId, activeModuleIndex: 0 });
      },

      // Fora do `commit` de propósito: o produto pertence ao cadastro, não à
      // cena. Passar pelo histórico faria Ctrl+Z "desfazer" uma foto que já
      // está gravada no banco, e sujaria a fila de gravação do planograma com
      // uma entidade que ela não sabe salvar.
      setProductRef: (product) =>
        set({ products: { ...get().products, [product.id]: product } }),

      // ── mobiliário ────────────────────────────────────────────────────────
      addFixture: (preset, name) => {
        const fixtureId = uid();
        const moduleId = uid();
        commit((draft) => {
          draft.fixtures[fixtureId] = {
            id: fixtureId,
            kind: preset.kind,
            name,
            order: draft.order.fixtures.length,
            widthMm: preset.widthMm,
            heightMm: preset.heightMm,
            depthMm: preset.depthMm,
            baseHeightMm: preset.baseHeightMm,
            colorHex: null,
            mapObjectId: null,
          };
          draft.order.fixtures.push(fixtureId);

          draft.modules[moduleId] = {
            id: moduleId,
            fixtureId,
            index: 0,
            widthMm: preset.widthMm,
            label: null,
          };
          draft.order.modulesByFixture[fixtureId] = [moduleId];

          const shelfIds: string[] = [];
          for (const shelf of buildShelvesForFixture(preset, moduleId)) {
            const shelfId = uid();
            draft.shelves[shelfId] = { ...shelf, id: shelfId };
            shelfIds.push(shelfId);
            draft.order.itemsByShelf[shelfId] = [];
          }
          draft.order.shelvesByModule[moduleId] = shelfIds;
        });
        set({ activeFixtureId: fixtureId, activeModuleIndex: 0 });
      },

      addFixtureFromTemplate: (template, name) => {
        const fixtureId = uid();
        commit((draft) => {
          draft.fixtures[fixtureId] = {
            id: fixtureId,
            kind: template.kind,
            name,
            order: draft.order.fixtures.length,
            widthMm: template.widthMm,
            heightMm: template.heightMm,
            depthMm: template.depthMm,
            baseHeightMm: template.baseHeightMm,
            colorHex: template.colorHex,
            mapObjectId: null,
          };
          draft.order.fixtures.push(fixtureId);
          draft.order.modulesByFixture[fixtureId] = [];

          for (let index = 0; index < template.moduleCount; index++) {
            const moduleId = uid();
            draft.modules[moduleId] = {
              id: moduleId,
              fixtureId,
              index,
              widthMm: template.widthMm,
              label: null,
            };
            draft.order.modulesByFixture[fixtureId].push(moduleId);

            const shelfIds: string[] = [];
            // As alturas vêm do padrão, não recalculadas: a distribuição dos
            // níveis É o que a loja padronizou.
            template.shelves.forEach((shelf, shelfIndex) => {
              const shelfId = uid();
              draft.shelves[shelfId] = {
                id: shelfId,
                moduleId,
                index: shelfIndex,
                yMm: shelf.yMm,
                widthMm: shelf.widthMm,
                depthMm: shelf.depthMm,
                thicknessMm: shelf.thicknessMm,
                kind: shelf.kind,
                layoutMode: "PACKED",
                maxWeightKg: null,
                colorHex: shelf.colorHex,
                dividers: [],
              };
              shelfIds.push(shelfId);
              draft.order.itemsByShelf[shelfId] = [];
            });
            draft.order.shelvesByModule[moduleId] = shelfIds;
          }
        });
        set({ activeFixtureId: fixtureId, activeModuleIndex: 0 });
      },

      updateFixture: (id, patch) =>
        commit((draft) => {
          const fixture = draft.fixtures[id];
          if (fixture) Object.assign(fixture, patch);
        }),

      setFixtureHeight: (id, heightMm) => {
        const state = get();
        const fixture = state.fixtures[id];
        if (!fixture) return;

        const finalHeightMm = clampMm(snapMm(heightMm), 600, 6000);
        const shelfIds = (state.order.modulesByFixture[id] ?? []).flatMap(
          (moduleId) => state.order.shelvesByModule[moduleId] ?? [],
        );

        // Baixar o teto não pode deixar prateleira flutuando fora da estrutura:
        // as que ficariam de fora descem para o último nível que ainda cabe.
        const ceilingMm = finalHeightMm - TOP_CLEARANCE_MM;

        commit((draft) => {
          const target = draft.fixtures[id];
          if (!target) return;
          target.heightMm = finalHeightMm;

          for (const shelfId of shelfIds) {
            const shelf = draft.shelves[shelfId];
            if (shelf && shelf.yMm > ceilingMm) {
              shelf.yMm = Math.max(target.baseHeightMm, ceilingMm);
            }
          }
        });
      },

      removeFixture: (id) => {
        const state = get();
        const moduleIds = state.order.modulesByFixture[id] ?? [];
        const shelfIds = moduleIds.flatMap(
          (moduleId) => state.order.shelvesByModule[moduleId] ?? [],
        );
        const itemIds = shelfIds.flatMap(
          (shelfId) => state.order.itemsByShelf[shelfId] ?? [],
        );

        commit((draft) => {
          for (const itemId of itemIds) delete draft.items[itemId];
          for (const shelfId of shelfIds) {
            delete draft.shelves[shelfId];
            delete draft.order.itemsByShelf[shelfId];
          }
          for (const moduleId of moduleIds) {
            delete draft.modules[moduleId];
            delete draft.order.shelvesByModule[moduleId];
          }
          delete draft.fixtures[id];
          delete draft.order.modulesByFixture[id];
          draft.order.fixtures = draft.order.fixtures.filter(
            (fixtureId) => fixtureId !== id,
          );
        });

        const deleted = new Set(get().deleted);
        for (const itemId of itemIds) deleted.add(`item:${itemId}`);
        for (const shelfId of shelfIds) deleted.add(`shelf:${shelfId}`);
        for (const moduleId of moduleIds) deleted.add(`module:${moduleId}`);
        deleted.add(`fixture:${id}`);
        set({ deleted, activeFixtureId: get().order.fixtures[0] ?? null });
      },

      addModule: (fixtureId) => {
        const state = get();
        const fixture = state.fixtures[fixtureId];
        if (!fixture) return;
        const siblings = state.order.modulesByFixture[fixtureId] ?? [];
        // Copia a configuração de prateleiras do módulo anterior: montar
        // gôndola dupla com alturas diferentes nunca é o que se quer.
        const previousId = siblings[siblings.length - 1];
        const template = (state.order.shelvesByModule[previousId] ?? []).map(
          (shelfId) => state.shelves[shelfId],
        );
        const moduleId = uid();

        commit((draft) => {
          draft.modules[moduleId] = {
            id: moduleId,
            fixtureId,
            index: siblings.length,
            widthMm: fixture.widthMm,
            label: null,
          };
          if (!draft.order.modulesByFixture[fixtureId]) {
            draft.order.modulesByFixture[fixtureId] = [];
          }
          draft.order.modulesByFixture[fixtureId].push(moduleId);

          const shelfIds: string[] = [];
          for (const source of template) {
            const shelfId = uid();
            draft.shelves[shelfId] = {
              ...source,
              id: shelfId,
              moduleId,
              dividers: [],
            };
            shelfIds.push(shelfId);
            draft.order.itemsByShelf[shelfId] = [];
          }
          draft.order.shelvesByModule[moduleId] = shelfIds;
        });
        set({ activeModuleIndex: siblings.length });
      },

      removeModule: (moduleId) => {
        const state = get();
        const moduleNode = state.modules[moduleId];
        if (!moduleNode) return;
        const shelfIds = state.order.shelvesByModule[moduleId] ?? [];
        const itemIds = shelfIds.flatMap(
          (shelfId) => state.order.itemsByShelf[shelfId] ?? [],
        );

        commit((draft) => {
          for (const itemId of itemIds) delete draft.items[itemId];
          for (const shelfId of shelfIds) {
            delete draft.shelves[shelfId];
            delete draft.order.itemsByShelf[shelfId];
          }
          delete draft.modules[moduleId];
          delete draft.order.shelvesByModule[moduleId];
          const list = draft.order.modulesByFixture[moduleNode.fixtureId] ?? [];
          draft.order.modulesByFixture[moduleNode.fixtureId] = list.filter(
            (id) => id !== moduleId,
          );
          // Reindexa para "Módulo 2/3" continuar coerente.
          draft.order.modulesByFixture[moduleNode.fixtureId].forEach(
            (id, index) => {
              const sibling = draft.modules[id];
              if (sibling) sibling.index = index;
            },
          );
        });

        const deleted = new Set(get().deleted);
        for (const itemId of itemIds) deleted.add(`item:${itemId}`);
        for (const shelfId of shelfIds) deleted.add(`shelf:${shelfId}`);
        deleted.add(`module:${moduleId}`);
        set({ deleted, activeModuleIndex: 0 });
      },

      // ── prateleiras ───────────────────────────────────────────────────────
      addShelf: (moduleId) => {
        const state = get();
        const moduleNode = state.modules[moduleId];
        const fixture = moduleNode
          ? state.fixtures[moduleNode.fixtureId]
          : undefined;
        if (!moduleNode || !fixture) return;

        const existing = (state.order.shelvesByModule[moduleId] ?? []).map(
          (id) => state.shelves[id],
        );
        const highest = existing.reduce(
          (max, shelf) => Math.max(max, shelf.yMm),
          fixture.baseHeightMm,
        );
        // Encaixa no meio do vão que sobra acima da prateleira mais alta.
        const yMm = Math.round(highest + (fixture.heightMm - highest) / 2);
        const shelfId = uid();

        commit((draft) => {
          draft.shelves[shelfId] = {
            id: shelfId,
            moduleId,
            index: existing.length,
            yMm,
            widthMm: moduleNode.widthMm,
            depthMm: fixture.depthMm,
            thicknessMm: 25,
            kind: "PRATELEIRA",
            layoutMode: "PACKED",
            maxWeightKg: null,
            colorHex: null,
            dividers: [],
          };
          if (!draft.order.shelvesByModule[moduleId]) {
            draft.order.shelvesByModule[moduleId] = [];
          }
          draft.order.shelvesByModule[moduleId].push(shelfId);
          draft.order.itemsByShelf[shelfId] = [];
        });
        // Já nasce selecionada: a prateleira nova precisa ficar disponível para
        // arrastar e ajustar na hora, sem o usuário ter que caçá-la no canvas.
        set({ selection: { kind: "shelf", ids: [shelfId] } });
      },

      duplicateShelf: (sourceId) => {
        const state = get();
        const source = state.shelves[sourceId];
        if (!source) return;
        const moduleNode = state.modules[source.moduleId];
        const fixture = moduleNode
          ? state.fixtures[moduleNode.fixtureId]
          : undefined;
        if (!fixture) return;

        const siblings = (state.order.shelvesByModule[source.moduleId] ?? [])
          .map((id) => state.shelves[id])
          .sort((a, b) => a.yMm - b.yMm);

        // Nasce no meio do vão ACIMA da original; se não couber (menos de
        // 100mm), tenta o vão abaixo. Duplicar em cima da própria original
        // deixaria as duas sobrepostas e invisíveis uma sob a outra.
        const above = siblings.find((shelf) => shelf.yMm > source.yMm);
        const below = [...siblings]
          .reverse()
          .find((shelf) => shelf.yMm < source.yMm);
        const ceilingMm = above?.yMm ?? fixture.heightMm;
        const floorMm = below?.yMm ?? fixture.baseHeightMm;

        let yMm: number;
        if (ceilingMm - source.yMm >= 100) {
          yMm = Math.round(source.yMm + (ceilingMm - source.yMm) / 2);
        } else if (source.yMm - floorMm >= 100) {
          yMm = Math.round(floorMm + (source.yMm - floorMm) / 2);
        } else {
          return; // sem vão em nenhum dos lados
        }

        const shelfId = uid();
        commit((draft) => {
          draft.shelves[shelfId] = {
            ...source,
            id: shelfId,
            yMm,
            index: siblings.length,
            dividers: [...source.dividers],
          };
          if (!draft.order.shelvesByModule[source.moduleId]) {
            draft.order.shelvesByModule[source.moduleId] = [];
          }
          draft.order.shelvesByModule[source.moduleId].push(shelfId);
          draft.order.itemsByShelf[shelfId] = [];
        });
        set({ selection: { kind: "shelf", ids: [shelfId] } });
      },

      updateShelf: (id, patch) =>
        commit((draft) => {
          const shelf = draft.shelves[id];
          if (shelf) Object.assign(shelf, patch);
        }),

      moveShelfY: (id, yMm) => {
        const state = get();
        const shelf = state.shelves[id];
        if (!shelf) return yMm;
        const moduleNode = state.modules[shelf.moduleId];
        const fixture = moduleNode
          ? state.fixtures[moduleNode.fixtureId]
          : undefined;
        if (!fixture) return shelf.yMm;

        // Não deixa cruzar as vizinhas: prateleira atravessando a de cima é
        // estado impossível no mundo físico.
        const siblings = (state.order.shelvesByModule[shelf.moduleId] ?? [])
          .map((shelfId) => state.shelves[shelfId])
          .filter((candidate) => candidate.id !== id)
          .sort((a, b) => a.yMm - b.yMm);
        const below = siblings.filter((s) => s.yMm < shelf.yMm).pop();
        const above = siblings.find((s) => s.yMm > shelf.yMm);
        const minMm = (below?.yMm ?? fixture.baseHeightMm) + 50;
        const maxMm = (above?.yMm ?? fixture.heightMm) - 50;

        const finalYMm = clampMm(snapMm(yMm), minMm, maxMm);
        commit((draft) => {
          const target = draft.shelves[id];
          if (target) target.yMm = finalYMm;
        });
        // Devolvido para o canvas reposicionar o nó Konva quando o arraste é
        // travado: sem isso a barra ficaria parada onde o mouse soltou, fora
        // de sincronia com o estado.
        return finalYMm;
      },

      removeShelf: (id) => {
        const state = get();
        const shelf = state.shelves[id];
        if (!shelf) return;
        const itemIds = state.order.itemsByShelf[id] ?? [];

        commit((draft) => {
          delete draft.shelves[id];
          delete draft.order.itemsByShelf[id];
          const list = draft.order.shelvesByModule[shelf.moduleId] ?? [];
          draft.order.shelvesByModule[shelf.moduleId] = list.filter(
            (shelfId) => shelfId !== id,
          );
          draft.order.shelvesByModule[shelf.moduleId].forEach(
            (shelfId, index) => {
              const sibling = draft.shelves[shelfId];
              if (sibling) sibling.index = index;
            },
          );
          // Os itens NÃO são descartados em silêncio: vão para o banco de não
          // posicionados, com badge de contagem no painel lateral.
          for (const itemId of itemIds) {
            const item = draft.items[itemId];
            if (item) item.shelfId = "";
          }
          draft.unplacedItemIds = [...draft.unplacedItemIds, ...itemIds];
        });

        const deleted = new Set(get().deleted);
        deleted.add(`shelf:${id}`);
        set({ deleted });
      },

      // ── itens ─────────────────────────────────────────────────────────────
      addItem: (shelfId, product, options = {}) => {
        const state = get();
        const shelf = state.shelves[shelfId];
        if (!shelf) return;
        // Sem medida cadastrada não dá para empacotar; a UI abre o modal de
        // "Redimensionar Produto" antes de chegar aqui.
        if (product.widthMm == null || product.heightMm == null) return;

        const siblings = (state.order.itemsByShelf[shelfId] ?? []).map(
          (id) => state.items[id],
        );
        const index =
          options.dropXMm != null
            ? insertIndexAt(shelf, siblings, options.dropXMm)
            : siblings.length;
        const itemId = uid();

        // Produto é dado de REFERÊNCIA, não entidade da cena: hidratar dentro
        // do commit faria o undo da inserção apagar o cadastro junto, e o redo
        // ressuscitaria uma foto antiga por cima de uma recém-enviada.
        set({ products: { ...state.products, [product.id]: product } });

        commit((draft) => {
          draft.items[itemId] = {
            id: itemId,
            shelfId,
            productId: product.id,
            position: index,
            xMm: shelf.layoutMode === "FREE" ? (options.dropXMm ?? 0) : null,
            facings: options.facings ?? 1,
            facingsDeep: 1,
            facingsHigh: 1,
            orientation: "FRENTE",
            isBoxed: false,
            widthMm: product.widthMm ?? 0,
            heightMm: product.heightMm ?? 0,
            depthMm: product.depthMm ?? 0,
            note: null,
          };
          const list = draft.order.itemsByShelf[shelfId] ?? [];
          list.splice(index, 0, itemId);
          draft.order.itemsByShelf[shelfId] = list;
          list.forEach((id, position) => {
            const entry = draft.items[id];
            if (entry) entry.position = position;
          });
        });
        set({ selection: { kind: "item", ids: [itemId] } });
      },

      updateItem: (id, patch) =>
        commit((draft) => {
          const item = draft.items[id];
          if (item) Object.assign(item, patch);
        }),

      setItemFacings: (id, facings) =>
        commit((draft) => {
          const item = draft.items[id];
          // Zero frentes não existe: remover o item é outra ação, explícita.
          if (item) item.facings = Math.max(1, Math.round(facings));
        }),

      moveItem: (id, toShelfId, dropXMm) => {
        const state = get();
        const item = state.items[id];
        const target = state.shelves[toShelfId];
        if (!item || !target) return;

        const fromShelfId = item.shelfId;
        const targetItems = (state.order.itemsByShelf[toShelfId] ?? [])
          .filter((itemId) => itemId !== id)
          .map((itemId) => state.items[itemId]);
        const index = insertIndexAt(target, targetItems, dropXMm);

        if (fromShelfId === toShelfId) {
          const moved = reorderPositions(
            (state.order.itemsByShelf[toShelfId] ?? []).map(
              (itemId) => state.items[itemId],
            ),
            id,
            index,
          );
          if (moved.length === 0) return;
          commit((draft) => {
            for (const entry of moved) {
              const target = draft.items[entry.id];
              if (target) target.position = entry.position;
            }
            draft.order.itemsByShelf[toShelfId] = [
              ...(draft.order.itemsByShelf[toShelfId] ?? []),
            ].sort(
              (a, b) =>
                (draft.items[a]?.position ?? 0) -
                (draft.items[b]?.position ?? 0),
            );
          });
          return;
        }

        commit((draft) => {
          const moving = draft.items[id];
          if (!moving) return;
          moving.shelfId = toShelfId;
          if (target.layoutMode === "FREE") moving.xMm = snapMm(dropXMm);

          draft.order.itemsByShelf[fromShelfId] = (
            draft.order.itemsByShelf[fromShelfId] ?? []
          ).filter((itemId) => itemId !== id);
          draft.order.itemsByShelf[fromShelfId].forEach((itemId, position) => {
            const entry = draft.items[itemId];
            if (entry) entry.position = position;
          });

          const list = draft.order.itemsByShelf[toShelfId] ?? [];
          list.splice(index, 0, id);
          draft.order.itemsByShelf[toShelfId] = list;
          list.forEach((itemId, position) => {
            const entry = draft.items[itemId];
            if (entry) entry.position = position;
          });
        });
      },

      removeItem: (id) => {
        const state = get();
        const item = state.items[id];
        if (!item) return;
        const shelfId = item.shelfId;

        commit((draft) => {
          delete draft.items[id];
          draft.order.itemsByShelf[shelfId] = (
            draft.order.itemsByShelf[shelfId] ?? []
          ).filter((itemId) => itemId !== id);
          draft.order.itemsByShelf[shelfId].forEach((itemId, position) => {
            const entry = draft.items[itemId];
            if (entry) entry.position = position;
          });
          draft.unplacedItemIds = draft.unplacedItemIds.filter(
            (itemId) => itemId !== id,
          );
        });

        const deleted = new Set(get().deleted);
        deleted.add(`item:${id}`);
        set({ deleted, selection: { kind: null, ids: [] } });
      },

      // ── histórico ─────────────────────────────────────────────────────────
      undo: () => {
        const state = get();
        const transaction = state.past[state.past.length - 1];
        if (!transaction) return;

        const next = applyPatches(state, transaction.inverse);
        const generation = state.generation + 1;
        const dirty = new Map(state.dirty);
        // Só o que a transação tocou — não a cena inteira.
        for (const key of transaction.touched) dirty.set(key, generation);

        set({
          ...(next as PlanogramState),
          dirty,
          generation,
          past: state.past.slice(0, -1),
          future: [transaction, ...state.future],
        });
      },

      redo: () => {
        const state = get();
        const [transaction, ...rest] = state.future;
        if (!transaction) return;

        const next = applyPatches(state, transaction.patches);
        const generation = state.generation + 1;
        const dirty = new Map(state.dirty);
        for (const key of transaction.touched) dirty.set(key, generation);

        set({
          ...(next as PlanogramState),
          dirty,
          generation,
          past: [...state.past, transaction],
          future: rest,
        });
      },

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      // ── persistência ──────────────────────────────────────────────────────
      collectDirty: () => {
        const state = get();
        const upserts = [...state.dirty.entries()].map(([key, generation]) => {
          const [kind, id] = key.split(":") as [EntityKind, string];
          return { kind, id, generation };
        });
        return { upserts, deletes: [...state.deleted] };
      },

      commitClean: (consumed, deletes) => {
        const state = get();
        const dirty = new Map(state.dirty);
        for (const entry of consumed) {
          const key: EntityKey = `${entry.kind}:${entry.id}`;
          // Se a geração mudou, o usuário editou durante o voo do save —
          // manter sujo, senão a edição some sem aviso.
          if (dirty.get(key) === entry.generation) dirty.delete(key);
        }
        const deleted = new Set(state.deleted);
        for (const key of deletes) deleted.delete(key as EntityKey);
        set({ dirty, deleted });
      },

      hasPendingChanges: () => {
        const state = get();
        return state.dirty.size > 0 || state.deleted.size > 0;
      },
    };
  });
}

/** Extrai as entidades tocadas a partir dos caminhos dos patches. */
function collectTouched(patches: Patch[]): EntityKey[] {
  const keys = new Set<EntityKey>();
  for (const patch of patches) {
    const [collection, id] = patch.path;
    if (typeof id !== "string") continue;
    if (collection === "fixtures") keys.add(`fixture:${id}`);
    else if (collection === "modules") keys.add(`module:${id}`);
    else if (collection === "shelves") keys.add(`shelf:${id}`);
    else if (collection === "items") keys.add(`item:${id}`);
    else if (collection === "order") {
      // Mudança de ordem reposiciona itens; marca os da coleção afetada.
      const [, , shelfId] = patch.path;
      if (typeof shelfId === "string") keys.add(`shelf:${shelfId}`);
    }
  }
  return [...keys];
}
