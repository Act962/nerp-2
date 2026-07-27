"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import useImage from "use-image";
import { fitImageToFacing } from "../../engine/image-fit";
import { resolveItemColor, resolveItemLabel } from "../../engine/item-style";
import { usePlanogramStore } from "../../engine/planogram-store-context";
import type { Placement } from "../../engine/packing";

interface ShelfItemsProps {
  /** Origem X do vão útil — os montantes ficam fora dele. */
  baseX: number;
  baseY: number;
  placements: Placement[];
  overflowItemIds: string[];
  tooTallItemIds: string[];
}

export function ShelfItems({
  baseX,
  baseY,
  placements,
  overflowItemIds,
  tooTallItemIds,
}: ShelfItemsProps) {
  const items = usePlanogramStore((state) => state.items);
  const products = usePlanogramStore((state) => state.products);
  const view = usePlanogramStore((state) => state.view);
  const selection = usePlanogramStore((state) => state.selection);
  const setSelection = usePlanogramStore((state) => state.setSelection);

  return (
    <>
      {placements.map((placement) => {
        const item = items[placement.itemId];
        if (!item) return null;
        const product = products[item.productId];

        return (
          <ItemGroup
            key={item.id}
            itemId={item.id}
            xMm={baseX + placement.xMm}
            baseY={baseY}
            unitWidthMm={item.widthMm}
            unitHeightMm={item.heightMm}
            facings={item.facings}
            facingsHigh={item.facingsHigh}
            thumbnail={product?.thumbnail ?? null}
            color={resolveItemColor(product, view.colorBy)}
            label={resolveItemLabel(product, view.colorBy)}
            barcode={product?.barcode ?? null}
            showColors={view.showColors}
            showEans={view.showEans}
            isSelected={
              selection.kind === "item" && selection.ids.includes(item.id)
            }
            hasIssue={
              overflowItemIds.includes(item.id) ||
              tooTallItemIds.includes(item.id)
            }
            onSelect={() => setSelection("item", [item.id])}
          />
        );
      })}
    </>
  );
}

interface ItemGroupProps {
  itemId: string;
  xMm: number;
  baseY: number;
  unitWidthMm: number;
  unitHeightMm: number;
  facings: number;
  facingsHigh: number;
  thumbnail: string | null;
  color: string;
  label: string;
  barcode: string | null;
  showColors: boolean;
  showEans: boolean;
  isSelected: boolean;
  hasIssue: boolean;
  onSelect: () => void;
}

/**
 * Um item lógico vira N×M desenhos.
 *
 * A imagem é carregada UMA vez por produto e a mesma `HTMLImageElement` é
 * passada a todos os facings — Konva aceita e não redecodifica. Os filhos são
 * `listening={false}`: quem captura o clique é o Group, senão cada frente
 * viraria um alvo separado e a seleção ficaria imprevisível.
 */
function ItemGroup({
  xMm,
  baseY,
  unitWidthMm,
  unitHeightMm,
  facings,
  facingsHigh,
  thumbnail,
  color,
  label,
  barcode,
  showColors,
  showEans,
  isSelected,
  hasIssue,
  onSelect,
}: ItemGroupProps) {
  const [image] = useImage(
    thumbnail && !showColors ? constructUrl(thumbnail) : "",
    "anonymous",
  );

  const totalWidthMm = unitWidthMm * facings;
  const totalHeightMm = unitHeightMm * facingsHigh;
  const useImageRender = !showColors && !!image;

  const fit = fitImageToFacing(
    unitWidthMm,
    unitHeightMm,
    image?.naturalWidth ?? 0,
    image?.naturalHeight ?? 0,
  );

  const cells = [];
  for (let column = 0; column < facings; column++) {
    for (let row = 0; row < facingsHigh; row++) {
      const cellX = xMm + column * unitWidthMm;
      const cellY = baseY + row * unitHeightMm;
      cells.push(
        useImageRender ? (
          // A Layer inteira está espelhada no eixo Y para medir do piso para
          // cima; sem desespelhar aqui a foto sai de cabeça para baixo — mesmo
          // motivo do Group que envolve os rótulos mais abaixo.
          //
          // Nada é desenhado ATRÁS da foto: o recorte existe justamente para o
          // produto aparecer sem fundo na gôndola, e qualquer preenchimento
          // aqui reintroduz o retângulo que o recorte tirou. O espaço real da
          // embalagem é mostrado no contorno de seleção, não no fundo.
          <Group
            key={`${column}-${row}`}
            x={cellX + fit.offsetXMm}
            y={cellY + fit.drawHeightMm}
            scaleY={-1}
            listening={false}
          >
            <KonvaImage
              image={image}
              width={fit.drawWidthMm}
              height={fit.drawHeightMm}
              listening={false}
              perfectDrawEnabled={false}
            />
          </Group>
        ) : (
          <Rect
            key={`${column}-${row}`}
            x={cellX}
            y={cellY}
            width={unitWidthMm}
            height={unitHeightMm}
            fill={color}
            stroke="#ffffff"
            strokeWidth={2}
            strokeScaleEnabled={false}
            listening={false}
            perfectDrawEnabled={false}
          />
        ),
      );
    }
  }

  return (
    <Group onMouseDown={onSelect} onTap={onSelect}>
      {/* Área de captura do clique: cobre o bloco inteiro de facings. */}
      <Rect
        x={xMm}
        y={baseY}
        width={totalWidthMm}
        height={totalHeightMm}
        fill="transparent"
      />
      {cells}

      {showColors && (
        // O rótulo é desenhado invertido no eixo Y porque a Layer inteira está
        // espelhada para medir do piso para cima — sem isso, sairia de cabeça
        // para baixo.
        <Group x={xMm} y={baseY + totalHeightMm} scaleY={-1}>
          <Text
            text={label}
            width={totalWidthMm}
            height={totalHeightMm}
            align="center"
            verticalAlign="middle"
            fontSize={Math.min(60, totalWidthMm / 6)}
            fill="#ffffff"
            listening={false}
          />
        </Group>
      )}

      {showEans && barcode && (
        <Group x={xMm} y={baseY + totalHeightMm} scaleY={-1}>
          <Text
            text={barcode}
            width={totalWidthMm}
            align="center"
            y={totalHeightMm - 40}
            fontSize={32}
            fill="#0f172a"
            listening={false}
          />
        </Group>
      )}

      {(isSelected || hasIssue) && (
        <Rect
          x={xMm}
          y={baseY}
          width={totalWidthMm}
          height={totalHeightMm}
          stroke={hasIssue ? "#dc2626" : "#f59e0b"}
          strokeWidth={hasIssue ? 8 : 6}
          strokeScaleEnabled={false}
          dash={hasIssue ? [20, 12] : undefined}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
