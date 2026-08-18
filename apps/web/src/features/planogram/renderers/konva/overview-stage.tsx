"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import { packShelf, shelfClearanceMm } from "../../engine/packing";
import { usePlanogramStore } from "../../engine/planogram-store-context";
import {
  DEFAULT_BEAM_HEX,
  DEFAULT_UPRIGHT_HEX,
} from "../../engine/rack-colors";
import { formatMmAsMeters } from "../../engine/units";
import { ShelfItems } from "./item-node";
import {
  BEAM_HEIGHT_MM,
  RackBeam,
  RackFoot,
  RackUpright,
  UPRIGHT_WIDTH_MM,
} from "./rack-frame";

// Vista de conjunto: TODAS as gôndolas do planograma, uma ao lado da outra, com
// todos os módulos de cada uma adjacentes — que é como o corredor aparece na
// loja. Somente leitura: clicar leva ao editor com aquela gôndola ativa.

const GAP_BETWEEN_FIXTURES_MM = 900;
const PADDING_MM = 300;
const LABEL_BAND_MM = 380;

interface OverviewStageProps {
  onSelectFixture: (fixtureId: string) => void;
}

export function OverviewStage({ onSelectFixture }: OverviewStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const fixtures = usePlanogramStore((state) => state.fixtures);
  const modules = usePlanogramStore((state) => state.modules);
  const shelves = usePlanogramStore((state) => state.shelves);
  const items = usePlanogramStore((state) => state.items);
  const order = usePlanogramStore((state) => state.order);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fixtureIds = order.fixtures.filter((id) => fixtures[id]);

  if (fixtureIds.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
      >
        Nenhuma gôndola neste planograma ainda.
      </div>
    );
  }

  // Layout numa passada: acumula o X de cada gôndola e mede o mundo inteiro.
  let cursorXMm = PADDING_MM;
  const placedFixtures = fixtureIds.map((fixtureId) => {
    const fixture = fixtures[fixtureId];
    const fixtureModuleIds = (order.modulesByFixture[fixtureId] ?? []).filter(
      (id) => modules[id],
    );
    const bayWidthMm = fixtureModuleIds.reduce(
      (total, id) => total + modules[id].widthMm,
      0,
    );
    const totalWidthMm = bayWidthMm + UPRIGHT_WIDTH_MM * 2;
    const placed = { fixture, fixtureModuleIds, bayWidthMm, xMm: cursorXMm };
    cursorXMm += totalWidthMm + GAP_BETWEEN_FIXTURES_MM;
    return placed;
  });

  const worldWidthMm = cursorXMm - GAP_BETWEEN_FIXTURES_MM + PADDING_MM;
  const tallestMm = Math.max(
    ...placedFixtures.map((entry) => entry.fixture.heightMm),
  );
  const worldHeightMm = tallestMm + PADDING_MM * 2 + LABEL_BAND_MM;
  const floorYMm = PADDING_MM + LABEL_BAND_MM;

  const scale = containerWidth > 0 ? containerWidth / worldWidthMm : 0;

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto rounded-lg border bg-white"
    >
      {containerWidth > 0 && (
        <Stage
          width={worldWidthMm * scale}
          height={worldHeightMm * scale}
          scaleX={scale}
          scaleY={scale}
        >
          <Layer y={worldHeightMm} scaleY={-1}>
            <Rect
              x={0}
              y={floorYMm - 20}
              width={worldWidthMm}
              height={20}
              fill="#cbd5e1"
              listening={false}
              perfectDrawEnabled={false}
            />

            {placedFixtures.map(
              ({ fixture, fixtureModuleIds, bayWidthMm, xMm }) => {
                const uprightHex = fixture.colorHex ?? DEFAULT_UPRIGHT_HEX;
                const bayXMm = xMm + UPRIGHT_WIDTH_MM;
                const topYMm = floorYMm + fixture.heightMm;

                return (
                  <Group
                    key={fixture.id}
                    onMouseDown={() => onSelectFixture(fixture.id)}
                    onTap={() => onSelectFixture(fixture.id)}
                  >
                    {/* Alvo de clique cobrindo a gôndola inteira, atrás do
                        desenho: sem ele só a estrutura seria clicável e o vão
                        entre prateleiras viraria um buraco morto. */}
                    <Rect
                      x={xMm}
                      y={floorYMm}
                      width={bayWidthMm + UPRIGHT_WIDTH_MM * 2}
                      height={fixture.heightMm}
                      fill="transparent"
                    />

                    <RackUpright
                      xMm={xMm}
                      baseYMm={floorYMm}
                      topYMm={topYMm}
                      colorHex={uprightHex}
                      isSelected={false}
                      onSelect={() => onSelectFixture(fixture.id)}
                    />
                    <RackUpright
                      xMm={bayXMm + bayWidthMm}
                      baseYMm={floorYMm}
                      topYMm={topYMm}
                      colorHex={uprightHex}
                      isSelected={false}
                      onSelect={() => onSelectFixture(fixture.id)}
                    />
                    <RackFoot xMm={xMm} baseYMm={floorYMm} />
                    <RackFoot xMm={bayXMm + bayWidthMm} baseYMm={floorYMm} />

                    {fixtureModuleIds.map((moduleId, moduleIndex) => {
                      const moduleNode = modules[moduleId];
                      const moduleXMm =
                        bayXMm +
                        fixtureModuleIds
                          .slice(0, moduleIndex)
                          .reduce(
                            (total, id) => total + modules[id].widthMm,
                            0,
                          );

                      const moduleShelves = (
                        order.shelvesByModule[moduleId] ?? []
                      )
                        .map((shelfId) => shelves[shelfId])
                        .filter(Boolean);

                      return (
                        <Group key={moduleId}>
                          {/* Divisa entre módulos da mesma gôndola. */}
                          {moduleIndex > 0 && (
                            <Rect
                              x={moduleXMm - 4}
                              y={floorYMm}
                              width={8}
                              height={fixture.heightMm}
                              fill={uprightHex}
                              opacity={0.35}
                              listening={false}
                              perfectDrawEnabled={false}
                            />
                          )}

                          {moduleShelves.map((shelf) => {
                            const shelfItems = (
                              order.itemsByShelf[shelf.id] ?? []
                            )
                              .map((itemId) => items[itemId])
                              .filter(Boolean);
                            const clearanceMm = shelfClearanceMm(
                              shelf,
                              moduleShelves,
                              fixture.heightMm,
                            );
                            const packed = packShelf(shelf, shelfItems, {
                              clearanceMm,
                            });

                            return (
                              <Group key={shelf.id}>
                                <RackBeam
                                  xMm={moduleXMm}
                                  topYMm={floorYMm + shelf.yMm}
                                  widthMm={moduleNode.widthMm}
                                  colorHex={shelf.colorHex ?? DEFAULT_BEAM_HEX}
                                  isOverflowing={packed.overflowMm > 0}
                                  isSelected={false}
                                  draggable={false}
                                  onSelect={() => onSelectFixture(fixture.id)}
                                  onDragMoveY={(y) => y}
                                  onDragEndY={(y) => y}
                                />
                                <ShelfItems
                                  baseX={moduleXMm}
                                  baseY={floorYMm + shelf.yMm}
                                  placements={packed.placements}
                                  overflowItemIds={packed.overflowItemIds}
                                  tooTallItemIds={packed.tooTallItemIds}
                                />
                              </Group>
                            );
                          })}
                        </Group>
                      );
                    })}

                    <FixtureLabel
                      xMm={xMm}
                      yMm={topYMm + BEAM_HEIGHT_MM}
                      widthMm={bayWidthMm + UPRIGHT_WIDTH_MM * 2}
                      title={fixture.name}
                      subtitle={`${formatMmAsMeters(bayWidthMm)} × ${formatMmAsMeters(
                        fixture.heightMm,
                      )} · ${fixtureModuleIds.length} módulo(s)`}
                    />
                  </Group>
                );
              },
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}

/**
 * Rótulo acima da gôndola. Desenhado num Group desespelhado porque a Layer
 * inteira está invertida no eixo Y — sem isso o texto sairia de cabeça para
 * baixo.
 */
function FixtureLabel({
  xMm,
  yMm,
  widthMm,
  title,
  subtitle,
}: {
  xMm: number;
  yMm: number;
  widthMm: number;
  title: string;
  subtitle: string;
}) {
  return (
    <Group x={xMm} y={yMm + LABEL_BAND_MM} scaleY={-1} listening={false}>
      <Text
        text={title}
        width={widthMm}
        align="center"
        fontSize={150}
        fontStyle="bold"
        fill="#0f172a"
        listening={false}
      />
      <Text
        text={subtitle}
        y={180}
        width={widthMm}
        align="center"
        fontSize={110}
        fill="#64748b"
        listening={false}
      />
    </Group>
  );
}
