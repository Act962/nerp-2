"use client";

import { Group, Rect } from "react-konva";
import { OVERFLOW_HEX, shadeHex } from "../../engine/rack-colors";

// Estrutura do porta-palete, no padrão da referência: montantes azuis
// perfurados, longarinas laranja e sapatas amarelas no piso.
// Medidas reais de porta-palete: montante ~90mm de face, longarina ~120mm de
// altura, sapata ~150mm. Tudo em milímetro, como o resto do engine.

export const RACK_YELLOW = "#f2b705";

export const UPRIGHT_WIDTH_MM = 90;
export const BEAM_HEIGHT_MM = 120;
const FOOT_HEIGHT_MM = 110;
const FOOT_WIDTH_MM = 150;

/** Passo das perfurações do montante — o "furo a cada 75mm" do padrão real. */
const SLOT_STEP_MM = 75;
const SLOT_WIDTH_MM = 22;
const SLOT_HEIGHT_MM = 26;

/**
 * Cantoneira de encaixe: a placa na ponta da longarina que encavala o montante.
 * É mais alta que a viga (transborda em cima e embaixo) e leva as garras que
 * entram nas perfurações — é esse detalhe que identifica um porta-palete.
 */
const CONNECTOR_WIDTH_MM = 78;
const CONNECTOR_OVERHANG_MM = 55;
const HOOK_WIDTH_MM = 30;
const HOOK_HEIGHT_MM = 22;
const HOOK_COUNT = 4;

function BeamConnector({
  xMm,
  isMirrored,
  fill,
}: {
  xMm: number;
  /** Espelha as garras para a esquerda, na ponta direita da longarina. */
  isMirrored: boolean;
  fill: string;
}) {
  const shadeFill = shadeHex(fill, 0.78);
  const plateHeightMm = BEAM_HEIGHT_MM + CONNECTOR_OVERHANG_MM * 2;
  const hookSpacingMm = (plateHeightMm - HOOK_HEIGHT_MM) / (HOOK_COUNT - 1);
  // As garras ficam na borda que encosta no montante — é onde entram nos furos.
  const hookX = isMirrored
    ? xMm - CONNECTOR_WIDTH_MM - 6
    : xMm + CONNECTOR_WIDTH_MM - HOOK_WIDTH_MM + 6;

  return (
    <Group listening={false}>
      <Rect
        x={isMirrored ? xMm - CONNECTOR_WIDTH_MM : xMm}
        y={-CONNECTOR_OVERHANG_MM}
        width={CONNECTOR_WIDTH_MM}
        height={plateHeightMm}
        fill={fill}
        cornerRadius={5}
        perfectDrawEnabled={false}
      />
      {/* Vinco vertical da chapa dobrada. */}
      <Rect
        x={
          isMirrored ? xMm - CONNECTOR_WIDTH_MM : xMm + CONNECTOR_WIDTH_MM - 14
        }
        y={-CONNECTOR_OVERHANG_MM}
        width={14}
        height={plateHeightMm}
        fill={shadeFill}
        perfectDrawEnabled={false}
      />
      {Array.from({ length: HOOK_COUNT }).map((_, index) => (
        <Rect
          key={index}
          x={hookX}
          y={-CONNECTOR_OVERHANG_MM + index * hookSpacingMm}
          width={HOOK_WIDTH_MM}
          height={HOOK_HEIGHT_MM}
          fill={shadeFill}
          cornerRadius={3}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  );
}

/**
 * Montante perfurado. As perfurações são o que dá a leitura de porta-palete —
 * sem elas a coluna vira uma barra azul qualquer.
 *
 * É clicável: selecionar o montante abre o editor de altura da estrutura, que é
 * o que o montante de fato define.
 */
export function RackUpright({
  xMm,
  baseYMm,
  topYMm,
  colorHex,
  isSelected,
  onSelect,
}: {
  xMm: number;
  baseYMm: number;
  topYMm: number;
  colorHex: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const shadeHexColor = shadeHex(colorHex, 0.7);
  const heightMm = topYMm - baseYMm;
  const slotCount = Math.max(0, Math.floor(heightMm / SLOT_STEP_MM) - 1);
  const slotX = xMm + (UPRIGHT_WIDTH_MM - SLOT_WIDTH_MM) / 2;

  return (
    <Group onMouseDown={onSelect} onTap={onSelect}>
      <Rect
        x={xMm}
        y={baseYMm}
        width={UPRIGHT_WIDTH_MM}
        height={heightMm}
        fill={colorHex}
        perfectDrawEnabled={false}
      />
      {/* Faixa lateral mais escura: dá volume à coluna sem custar nó extra
          por perfuração. */}
      <Rect
        x={xMm + UPRIGHT_WIDTH_MM - 18}
        y={baseYMm}
        width={18}
        height={heightMm}
        fill={shadeHexColor}
        perfectDrawEnabled={false}
      />
      {Array.from({ length: slotCount }).map((_, index) => (
        <Rect
          key={index}
          x={slotX}
          y={baseYMm + (index + 1) * SLOT_STEP_MM}
          width={SLOT_WIDTH_MM}
          height={SLOT_HEIGHT_MM}
          fill={shadeHexColor}
          cornerRadius={4}
          perfectDrawEnabled={false}
        />
      ))}
      {isSelected && (
        <Rect
          x={xMm - 8}
          y={baseYMm - 8}
          width={UPRIGHT_WIDTH_MM + 16}
          height={heightMm + 16}
          stroke="#0f172a"
          strokeWidth={6}
          strokeScaleEnabled={false}
          dash={[24, 14]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}

/** Sapata de nivelamento no pé do montante. */
export function RackFoot({ xMm, baseYMm }: { xMm: number; baseYMm: number }) {
  return (
    <Group listening={false}>
      <Rect
        x={xMm + (UPRIGHT_WIDTH_MM - FOOT_WIDTH_MM) / 2}
        y={baseYMm - FOOT_HEIGHT_MM}
        width={FOOT_WIDTH_MM}
        height={FOOT_HEIGHT_MM}
        fill={RACK_YELLOW}
        cornerRadius={6}
        perfectDrawEnabled={false}
      />
      <Rect
        x={xMm + (UPRIGHT_WIDTH_MM - FOOT_WIDTH_MM) / 2}
        y={baseYMm - FOOT_HEIGHT_MM}
        width={FOOT_WIDTH_MM}
        height={22}
        fill="#c99400"
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

/**
 * Longarina (a barra laranja onde o produto assenta).
 *
 * É o único elemento arrastável da estrutura: puxar para cima ou para baixo
 * reposiciona o nível, que é como se ajusta um porta-palete de verdade.
 */
export function RackBeam({
  xMm,
  topYMm,
  widthMm,
  colorHex,
  isOverflowing,
  isSelected,
  draggable,
  onSelect,
  onDragMoveY,
  onDragEndY,
}: {
  xMm: number;
  /** Face superior da longarina — é onde o produto assenta. */
  topYMm: number;
  widthMm: number;
  colorHex: string;
  isOverflowing: boolean;
  isSelected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragMoveY: (topYMm: number) => number;
  onDragEndY: (topYMm: number) => number;
}) {
  const fill = isOverflowing ? OVERFLOW_HEX : colorHex;
  const shadeFill = shadeHex(fill, 0.78);

  return (
    <Group
      x={xMm}
      y={topYMm - BEAM_HEIGHT_MM}
      draggable={draggable}
      onMouseDown={onSelect}
      onTap={onSelect}
      dragBoundFunc={(pos) => pos}
      onDragMove={(event) => {
        const node = event.target;
        // Trava horizontal: longarina só sobe e desce.
        node.x(xMm);
        const clamped = onDragMoveY(node.y() + BEAM_HEIGHT_MM);
        node.y(clamped - BEAM_HEIGHT_MM);
      }}
      onDragEnd={(event) => {
        const node = event.target;
        node.x(xMm);
        const settled = onDragEndY(node.y() + BEAM_HEIGHT_MM);
        node.y(settled - BEAM_HEIGHT_MM);
      }}
    >
      <Rect
        x={0}
        y={0}
        width={widthMm}
        height={BEAM_HEIGHT_MM}
        fill={fill}
        perfectDrawEnabled={false}
      />
      {/* Aba inferior escurecida: a dobra em C do perfil da longarina. */}
      <Rect
        x={0}
        y={0}
        width={widthMm}
        height={26}
        fill={shadeFill}
        perfectDrawEnabled={false}
      />

      {/* Cantoneiras nas duas pontas, encavalando os montantes. */}
      <BeamConnector xMm={-CONNECTOR_WIDTH_MM} isMirrored={false} fill={fill} />
      <BeamConnector
        xMm={widthMm + CONNECTOR_WIDTH_MM}
        isMirrored
        fill={fill}
      />
      {isSelected && (
        <Rect
          x={-6}
          y={-6}
          width={widthMm + 12}
          height={BEAM_HEIGHT_MM + 12}
          stroke="#0f172a"
          strokeWidth={6}
          strokeScaleEnabled={false}
          dash={[24, 14]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
