"use client";

import { useEffect, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";
import { packShelf, shelfClearanceMm } from "../../engine/packing";
import type { PlanogramState } from "../../engine/planogram-store";
import {
  usePlanogramStore,
  usePlanogramStoreApi,
} from "../../engine/planogram-store-context";
import {
  DEFAULT_BEAM_HEX,
  DEFAULT_UPRIGHT_HEX,
} from "../../engine/rack-colors";
import { ShelfItems } from "./item-node";
import { StageBackground } from "./stage-background";
import {
  BEAM_HEIGHT_MM,
  RackBeam,
  RackFoot,
  RackUpright,
  UPRIGHT_WIDTH_MM,
} from "./rack-frame";

// 1 unidade Konva = 1 MILÍMETRO. O Stage escala o mundo inteiro, então todas as
// shapes são desenhadas na medida real e nenhuma conversão aparece no meio do
// código. É a mesma ideia do map-stage (que usa metros), mas com a gôndola em
// dimensão fixa, no molde do cover-stage dos Books — não há mundo infinito a
// explorar aqui.

const PADDING_MM = 200;

interface PlanogramStageProps {
  onDropProduct?: (shelfId: string, xMm: number) => void;
}

export function PlanogramStage({ onDropProduct }: PlanogramStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const store = usePlanogramStoreApi();

  const activeFixtureId = usePlanogramStore((state) => state.activeFixtureId);
  const activeModuleIndex = usePlanogramStore(
    (state) => state.activeModuleIndex,
  );
  const fixtures = usePlanogramStore((state) => state.fixtures);
  const modules = usePlanogramStore((state) => state.modules);
  const shelves = usePlanogramStore((state) => state.shelves);
  const items = usePlanogramStore((state) => state.items);
  const order = usePlanogramStore((state) => state.order);
  const zoomLevel = usePlanogramStore((state) => state.view.zoomLevel);
  const showBackground = usePlanogramStore(
    (state) => state.view.showBackground,
  );
  const selection = usePlanogramStore((state) => state.selection);
  const setSelection = usePlanogramStore((state) => state.setSelection);
  const moveShelfY = usePlanogramStore((state) => state.moveShelfY);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fixture = activeFixtureId ? fixtures[activeFixtureId] : undefined;
  const moduleIds = activeFixtureId
    ? (order.modulesByFixture[activeFixtureId] ?? [])
    : [];
  const moduleId = moduleIds[activeModuleIndex];
  const moduleNode = moduleId ? modules[moduleId] : undefined;

  if (!fixture || !moduleNode) {
    return (
      <div
        ref={containerRef}
        className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
      >
        Nenhuma gôndola ainda. Clique em "Criar gôndola" para começar.
      </div>
    );
  }

  // Os montantes ficam FORA do vão útil: a largura do módulo é o espaço entre
  // eles, que é como se mede porta-palete de verdade.
  const worldWidthMm =
    moduleNode.widthMm + UPRIGHT_WIDTH_MM * 2 + PADDING_MM * 2;
  const worldHeightMm = fixture.heightMm + PADDING_MM * 2;
  const fitScale = containerWidth > 0 ? containerWidth / worldWidthMm : 0;
  const scale = fitScale * zoomLevel;

  const bayXMm = PADDING_MM + UPRIGHT_WIDTH_MM;
  const floorYMm = PADDING_MM;
  const uprightHex = fixture.colorHex ?? DEFAULT_UPRIGHT_HEX;
  const isFixtureSelected =
    selection.kind === "fixture" && selection.ids.includes(fixture.id);

  const moduleShelves = (order.shelvesByModule[moduleNode.id] ?? [])
    .map((shelfId) => shelves[shelfId])
    .filter(Boolean);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!onDropProduct) return;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || scale === 0) return;

    // Converte o ponto do mouse de volta para milímetro do mundo.
    const xMm = (event.clientX - bounds.left) / scale - bayXMm;
    const yMm = worldHeightMm - (event.clientY - bounds.top) / scale - floorYMm;

    // A prateleira alvo é a de topo imediatamente abaixo do ponto solto —
    // é onde o produto assentaria de fato.
    const target = [...moduleShelves]
      .filter((shelf) => shelf.yMm <= yMm + 80)
      .sort((a, b) => b.yMm - a.yMm)[0];
    if (target) onDropProduct(target.id, Math.max(0, Math.round(xMm)));
  }

  return (
    // Zona de solta do drag-and-drop de produto. O caminho acessível é o
    // clique no card do seletor, que posiciona sem exigir arraste.
    // biome-ignore lint/a11y/noStaticElementInteractions: arrastar é atalho; posicionar por clique no seletor é o caminho acessível
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto rounded-lg border bg-white"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {containerWidth > 0 && (
        <Stage
          width={worldWidthMm * scale}
          height={worldHeightMm * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) {
              setSelection(null, []);
            }
          }}
        >
          {/* Konva desenha do topo para baixo; a gôndola se mede do piso para
              cima. O offset inverte o eixo Y uma vez só, aqui — todo o resto
              do arquivo pensa em "altura a partir do chão". */}
          <Layer y={worldHeightMm} scaleY={-1}>
            {showBackground && (
              <StageBackground
                worldWidthMm={worldWidthMm}
                worldHeightMm={worldHeightMm}
              />
            )}

            {/* Piso */}
            <Rect
              x={0}
              y={floorYMm - 14}
              width={worldWidthMm}
              height={14}
              fill="#cbd5e1"
              listening={false}
              perfectDrawEnabled={false}
            />

            <RackUpright
              xMm={PADDING_MM}
              baseYMm={floorYMm}
              topYMm={floorYMm + fixture.heightMm}
              colorHex={uprightHex}
              isSelected={isFixtureSelected}
              onSelect={() => setSelection("fixture", [fixture.id])}
            />
            <RackUpright
              xMm={bayXMm + moduleNode.widthMm}
              baseYMm={floorYMm}
              topYMm={floorYMm + fixture.heightMm}
              colorHex={uprightHex}
              isSelected={isFixtureSelected}
              onSelect={() => setSelection("fixture", [fixture.id])}
            />
            <RackFoot xMm={PADDING_MM} baseYMm={floorYMm} />
            <RackFoot xMm={bayXMm + moduleNode.widthMm} baseYMm={floorYMm} />

            {moduleShelves.map((shelf) => {
              const shelfItems = (order.itemsByShelf[shelf.id] ?? [])
                .map((itemId) => items[itemId])
                .filter(Boolean);
              const clearanceMm = shelfClearanceMm(
                shelf,
                moduleShelves,
                fixture.heightMm,
              );
              const packed = packShelf(shelf, shelfItems, { clearanceMm });
              const isSelected =
                selection.kind === "shelf" && selection.ids.includes(shelf.id);

              return (
                <RackBeam
                  key={shelf.id}
                  xMm={bayXMm}
                  topYMm={floorYMm + shelf.yMm}
                  widthMm={shelf.widthMm}
                  colorHex={shelf.colorHex ?? DEFAULT_BEAM_HEX}
                  isOverflowing={packed.overflowMm > 0}
                  isSelected={isSelected}
                  draggable
                  onSelect={() => setSelection("shelf", [shelf.id])}
                  // Durante o arraste só trava nos limites, sem gravar: gravar
                  // a cada frame encheria o histórico de undo com dezenas de
                  // passos de um gesto só.
                  onDragMoveY={(topYMm) => {
                    const desired = topYMm - floorYMm;
                    const limits = shelfDragLimits(
                      store.getState(),
                      shelf.id,
                      fixture.heightMm,
                    );
                    const clamped = Math.min(
                      Math.max(desired, limits.minMm),
                      limits.maxMm,
                    );
                    return floorYMm + clamped;
                  }}
                  onDragEndY={(topYMm) =>
                    floorYMm + moveShelfY(shelf.id, topYMm - floorYMm)
                  }
                />
              );
            })}

            {/* Produtos por cima da estrutura, para a longarina não cobrir a
                base das embalagens. */}
            {moduleShelves.map((shelf) => {
              const shelfItems = (order.itemsByShelf[shelf.id] ?? [])
                .map((itemId) => items[itemId])
                .filter(Boolean);
              const clearanceMm = shelfClearanceMm(
                shelf,
                moduleShelves,
                fixture.heightMm,
              );
              const packed = packShelf(shelf, shelfItems, { clearanceMm });

              return (
                <ShelfItems
                  key={shelf.id}
                  baseX={bayXMm}
                  baseY={floorYMm + shelf.yMm}
                  placements={packed.placements}
                  overflowItemIds={packed.overflowItemIds}
                  tooTallItemIds={packed.tooTallItemIds}
                />
              );
            })}
          </Layer>
        </Stage>
      )}
    </div>
  );
}

/** Limites do arraste: não cruzar as vizinhas nem sair da estrutura. */
function shelfDragLimits(
  state: PlanogramState,
  shelfId: string,
  fixtureHeightMm: number,
) {
  const shelf = state.shelves[shelfId];
  if (!shelf) return { minMm: 0, maxMm: fixtureHeightMm };

  const siblings = (state.order.shelvesByModule[shelf.moduleId] ?? [])
    .map((id) => state.shelves[id])
    .filter((candidate) => candidate && candidate.id !== shelfId)
    .sort((a, b) => a.yMm - b.yMm);

  const below = siblings.filter((entry) => entry.yMm < shelf.yMm).pop();
  const above = siblings.find((entry) => entry.yMm > shelf.yMm);
  const moduleNode = state.modules[shelf.moduleId];
  const fixture = moduleNode ? state.fixtures[moduleNode.fixtureId] : undefined;

  return {
    minMm: (below?.yMm ?? fixture?.baseHeightMm ?? 0) + BEAM_HEIGHT_MM + 20,
    maxMm: (above?.yMm ?? fixtureHeightMm) - BEAM_HEIGHT_MM - 20,
  };
}

export { PlanogramStage as default };
