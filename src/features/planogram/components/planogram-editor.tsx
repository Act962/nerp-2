"use client";

import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FixturePreset } from "../engine/fixture-presets";
import type { FixtureTemplate } from "../engine/types";
import {
  PlanogramStoreProvider,
  usePlanogramStore,
  usePlanogramStoreApi,
} from "../engine/planogram-store-context";
import type { ProductRef } from "../engine/types";
import { usePlanogramAutosave } from "../hooks/use-planogram-autosave";
import {
  useCreatePlanogramVersion,
  usePlanogramFull,
} from "../hooks/use-planograms";
import { CreateFixtureDialog } from "./create-fixture-dialog";
import { EditorToolbar } from "./editor-toolbar";
import { MeasureProductDialog } from "./measure-product-dialog";
import { ProductPicker } from "./product-picker";
import { PropertiesPanel } from "./properties-panel";

// Konva nunca no bundle do servidor: sem ssr:false o build quebra com
// "Can't resolve 'canvas'".
const PlanogramStage = dynamic(
  () =>
    import("../renderers/konva/planogram-stage").then(
      (mod) => mod.PlanogramStage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    ),
  },
);

export function PlanogramEditor({ planogramId }: { planogramId: string }) {
  const { scene, isLoading } = usePlanogramFull(planogramId);

  if (isLoading || !scene) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    // A key garante store novo ao trocar de planograma — sem ela, o histórico
    // e a fila de persistência do anterior vazariam para o próximo.
    <PlanogramStoreProvider key={planogramId} scene={scene}>
      <EditorShell planogramId={planogramId} />
    </PlanogramStoreProvider>
  );
}

function EditorShell({ planogramId }: { planogramId: string }) {
  const store = usePlanogramStoreApi();
  const { saveState } = usePlanogramAutosave(planogramId);
  const createVersion = useCreatePlanogramVersion();

  const addFixture = usePlanogramStore((state) => state.addFixture);
  const addFixtureFromTemplate = usePlanogramStore(
    (state) => state.addFixtureFromTemplate,
  );
  const addItem = usePlanogramStore((state) => state.addItem);
  const setActiveFixture = usePlanogramStore((state) => state.setActiveFixture);
  const setProductRef = usePlanogramStore((state) => state.setProductRef);

  // A visão geral navega para cá com ?fixture=<id>; sem isso o clique abriria
  // sempre a primeira gôndola do planograma.
  const requestedFixtureId = useSearchParams().get("fixture");
  useEffect(() => {
    if (requestedFixtureId) setActiveFixture(requestedFixtureId);
  }, [requestedFixtureId, setActiveFixture]);

  const unplacedCount = usePlanogramStore(
    (state) => state.unplacedItemIds.length,
  );

  const [openCreateFixture, setOpenCreateFixture] = useState(false);
  // Guarda a INTENÇÃO junto do produto: abrir pelo lápis não pode posicionar
  // uma cópia de um produto que já está na gôndola.
  const [measuring, setMeasuring] = useState<{
    product: ProductRef;
    mode: "place" | "edit";
  } | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    shelfId: string;
    xMm: number;
  } | null>(null);

  // Atalhos de teclado, com guarda para não capturar dentro de campos de texto.
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.getState().redo();
        else store.getState().undo();
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const { selection, removeItem } = store.getState();
        if (selection.kind === "item" && selection.ids[0]) {
          event.preventDefault();
          removeItem(selection.ids[0]);
        }
      }
      if (event.key === "Escape") store.getState().setSelection(null, []);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  const placeProduct = useCallback(
    (product: ProductRef, target?: { shelfId: string; xMm: number }) => {
      const state = store.getState();
      // Sem alvo explícito, cai na prateleira selecionada ou na primeira.
      const shelfId =
        target?.shelfId ??
        (state.selection.kind === "shelf"
          ? state.selection.ids[0]
          : undefined) ??
        Object.keys(state.shelves)[0];
      if (!shelfId) return;
      addItem(shelfId, product, { dropXMm: target?.xMm });
    },
    [store, addItem],
  );

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[560px] flex-col gap-3">
      <EditorToolbar
        saveState={saveState}
        onCreateFixture={() => setOpenCreateFixture(true)}
        onSaveVersion={() => createVersion.mutate({ planogramId })}
        isSavingVersion={createVersion.isPending}
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="flex w-64 shrink-0 flex-col rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sortimento
          </p>
          <ProductPicker
            onPickProduct={(product) => placeProduct(product)}
            onNeedsDimensions={(product) =>
              setMeasuring({ product, mode: "place" })
            }
            onEditProduct={(product) => setMeasuring({ product, mode: "edit" })}
          />
          {unplacedCount > 0 && (
            <p className="mt-2 rounded-md bg-amber-500/10 p-2 text-[10px] text-amber-700">
              {unplacedCount} produto(s) sem prateleira — a prateleira que os
              continha foi removida.
            </p>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <PlanogramStage
            onDropProduct={(shelfId, xMm) => {
              // O drag nativo carrega só o id; o produto vem da lista já
              // carregada no picker, então guardamos o alvo e resolvemos no
              // clique seguinte se o id não estiver em memória.
              setPendingDrop({ shelfId, xMm });
            }}
          />
        </div>

        <aside className="w-72 shrink-0 overflow-y-auto rounded-lg border">
          <PropertiesPanel
            onEditProduct={(product) => setMeasuring({ product, mode: "edit" })}
          />
        </aside>
      </div>

      <CreateFixtureDialog
        open={openCreateFixture}
        onOpenChange={setOpenCreateFixture}
        onCreate={(preset: FixturePreset, name: string) =>
          addFixture(preset, name)
        }
        onCreateFromTemplate={(template: FixtureTemplate, name: string) =>
          addFixtureFromTemplate(template, name)
        }
      />

      <MeasureProductDialog
        product={measuring?.product ?? null}
        mode={measuring?.mode ?? "place"}
        onOpenChange={(open) => {
          if (!open) setMeasuring(null);
        }}
        onMeasured={(product) => {
          // Sempre repinta o cadastro na cena — é o que faz a foto nova
          // aparecer, inclusive nos itens já posicionados.
          setProductRef(product);
          if (measuring?.mode === "place") {
            placeProduct(product, pendingDrop ?? undefined);
          }
          setPendingDrop(null);
        }}
      />
    </div>
  );
}
