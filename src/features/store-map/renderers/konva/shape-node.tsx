"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  Text,
} from "react-konva";
import useImage from "use-image";
import { constructUrl } from "@/hooks/use-construct-url";
import { readFixtureProps } from "../../engine/fixture-catalog";
import { alignmentSnap, boundsOf } from "../../engine/geometry";
import { useSceneStore } from "../../engine/scene-store";
import { resolveObjectStyle } from "../../engine/space-state";
import type { Bounds, RectGeometry, SceneObject } from "../../engine/types";

const SNAP_PX = 8;
const DEFAULT_LABEL_FONT_M = 0.4;
const LABEL_COLOR = "#1e293b";

// Negociação de prateleiras: 0 negociadas = neutro; parcial = amarelo; cheio =
// verde. Cor da célula (mais clara) + cor do badge (sólida) por estado.
const NEGOTIATION_COLORS = {
  none: { cell: null as string | null, pill: "#94a3b8" },
  partial: { cell: "#fef08a", pill: "#f59e0b" },
  full: { cell: "#bbf7d0", pill: "#16a34a" },
};

function negotiationLevel(negotiated: number, total: number) {
  if (total <= 0 || negotiated <= 0) return "none" as const;
  return negotiated >= total ? ("full" as const) : ("partial" as const);
}

/**
 * Frame do eixo MAIOR da célula: centro no mundo (o RECT gira em torno do próprio
 * x,y) + ângulo do lado maior normalizado pra [-90,90] (texto sempre em pé). No
 * grupo resultante, x corre no comprimento (longDim) e y na profundidade
 * (shortDim). Nome e badge compartilham este frame pra ficarem em pontas opostas.
 */
function rectLongAxisFrame(g: RectGeometry) {
  const { x, y, width, height, rotation } = g;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = x + (width / 2) * cos - (height / 2) * sin;
  const cy = y + (width / 2) * sin + (height / 2) * cos;
  const longDim = Math.max(width, height);
  const shortDim = Math.min(width, height);
  let angle = rotation + (width >= height ? 0 : 90);
  angle = ((angle % 360) + 360) % 360;
  if (angle > 90 && angle <= 270) angle -= 180;
  return { cx, cy, angle, longDim, shortDim };
}

// Fração do comprimento reservada ao badge numa ponta — o nome fica na outra.
const BADGE_LENGTH_RATIO = 0.4;

/**
 * Badge "negociadas/total": etiqueta retangular (cantos retos) na PONTA do lado
 * maior da célula (frame compartilhado com o nome), por dentro. Acompanha a
 * rotação e nunca cobre o nome, que mora na ponta oposta. Não escuta eventos.
 */
function ShelfBadge({
  geometry,
  text,
  pill,
}: {
  geometry: RectGeometry;
  text: string;
  pill: string;
}) {
  const { cx, cy, angle, longDim, shortDim } = rectLongAxisFrame(geometry);
  const pillH = Math.min(shortDim * 0.3, 0.24);
  const font = pillH * 0.74;
  const chars = text.length * 0.58 + 0.3;
  const margin = shortDim * 0.12;
  const pillW = Math.min(font * chars, longDim * BADGE_LENGTH_RATIO);
  // Encosta na ponta +x (o nome ocupa a metade -x).
  const bx = longDim / 2 - margin - pillW;
  return (
    <Group x={cx} y={cy} rotation={angle} listening={false}>
      <Rect
        x={bx}
        y={-pillH / 2}
        width={pillW}
        height={pillH}
        fill={pill}
        cornerRadius={0}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
      />
      <Text
        text={text}
        x={bx}
        y={-pillH / 2}
        width={pillW}
        height={pillH}
        align="center"
        verticalAlign="middle"
        fontSize={font}
        fontStyle="bold"
        fill="#ffffff"
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

/**
 * Logo da indústria dentro da célula: contida (mantém proporção) e centralizada,
 * acompanhando a rotação do móvel. Não escuta eventos — o clique é do retângulo.
 */
function CellLogo({
  geometry,
  logoKey,
}: {
  geometry: RectGeometry;
  logoKey: string;
}) {
  const [image] = useImage(constructUrl(logoKey), "anonymous");
  if (!image || !image.width || !image.height) return null;
  const { x, y, width, height, rotation } = geometry;
  const pad = Math.min(width, height) * 0.12;
  const availW = Math.max(0, width - pad * 2);
  const availH = Math.max(0, height - pad * 2);
  const ratio = image.width / image.height;
  let w = availW;
  let h = availW / ratio;
  if (h > availH) {
    h = availH;
    w = availH * ratio;
  }
  return (
    <Group x={x} y={y} rotation={rotation} listening={false}>
      <KonvaImage
        image={image}
        x={(width - w) / 2}
        y={(height - h) / 2}
        width={w}
        height={h}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

/**
 * Rótulo de um RECT sempre alinhado ao LADO MAIOR e legível (nunca de cabeça
 * pra baixo). Acompanha a rotação do móvel: girou 90°, o nome gira junto e
 * continua correndo ao longo do comprimento da gôndola.
 */
function RectLabel({
  geometry,
  name,
  fontSize,
  hasBadge = false,
}: {
  geometry: RectGeometry;
  name: string;
  fontSize: number;
  /** Reserva a ponta do badge pro nome não ficar por baixo dele. */
  hasBadge?: boolean;
}) {
  const { cx, cy, angle, longDim, shortDim } = rectLongAxisFrame(geometry);

  const margin = shortDim * 0.12;
  const reserve = hasBadge ? longDim * (BADGE_LENGTH_RATIO + 0.04) : 0;
  // Comprimento disponível pro nome (fora a ponta do badge). O nome encaixa
  // numa única linha, reduzindo a fonte se preciso — assim aparece por inteiro.
  const availLen = Math.max(longDim - margin * 2 - reserve, longDim * 0.25);
  const byLen = availLen / Math.max(1, name.length * 0.58);
  const byHeight = shortDim * 0.78;
  const font = Math.max(0.05, Math.min(fontSize, byLen, byHeight));

  return (
    <Group x={cx} y={cy} rotation={angle} listening={false}>
      <Text
        text={name}
        x={-longDim / 2 + margin}
        y={-shortDim / 2}
        width={availLen}
        height={shortDim}
        align="center"
        verticalAlign="middle"
        wrap="none"
        ellipsis
        fontSize={font}
        fill={LABEL_COLOR}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

interface MapShapeProps {
  object: SceneObject;
  isSelected: boolean;
  draggable: boolean;
  showLabel?: boolean;
  /** Chave R2 da logo da indústria da célula; desenhada dentro da gôndola. */
  logoKey?: string | null;
  onHoverStart?: (id: string) => void;
  onHoverEnd?: () => void;
  // Só o viewer preenche isto (filtro/heatmap da Fase 4). O editor nunca
  // passa essas props, então este componente fica estruturalmente intacto
  // pra ele — resolveObjectStyle continua a única fonte de cor no editor.
  dimmed?: boolean;
  heatFill?: string;
}

export function MapShape({
  object,
  isSelected,
  draggable,
  showLabel = true,
  logoKey,
  onHoverStart,
  onHoverEnd,
  dimmed = false,
  heatFill,
}: MapShapeProps) {
  const updateObjectGeometry = useSceneStore(
    (state) => state.updateObjectGeometry,
  );
  const setSelection = useSceneStore((state) => state.setSelection);
  const toggleSelection = useSceneStore((state) => state.toggleSelection);
  const setGuides = useSceneStore((state) => state.setGuides);

  const applyDragSnap = (node: Konva.Node, dragBounds: Bounds) => {
    const state = useSceneStore.getState();
    const ppm = state.floorPlan?.pixelsPerMeter ?? 50;
    const scale = state.viewport.zoom * ppm;
    const threshold = SNAP_PX / scale;

    const others: Bounds[] = [];
    for (const other of Object.values(state.objects)) {
      if (other.id === object.id) continue;
      others.push(boundsOf(other.geometry));
    }

    const { dx, dy, guidesX, guidesY } = alignmentSnap(
      dragBounds,
      others,
      threshold,
      state.gridSizeM,
      state.snapEnabled,
    );
    if (dx !== 0) node.x(node.x() + dx);
    if (dy !== 0) node.y(node.y() + dy);
    setGuides({ x: guidesX, y: guidesY });
  };

  const clearGuides = () => setGuides({ x: [], y: [] });

  const handleSelect = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    event.cancelBubble = true;
    const isMultiSelect = "shiftKey" in event.evt && event.evt.shiftKey;
    if (isMultiSelect) {
      toggleSelection(object.id);
      return;
    }
    // Se a peça já faz parte de uma seleção múltipla, preserva o grupo — assim
    // o arraste move a estrutura inteira. Sem isto, o mousedown colapsaria a
    // seleção para uma peça só e o grupo se perderia.
    const { selectedIds } = useSceneStore.getState();
    if (selectedIds.length > 1 && selectedIds.includes(object.id)) return;
    setSelection([object.id]);
  };

  // Cor derivada do estado (livre/executado/pendente) para espaços negociáveis;
  // os demais tipos mantêm o estilo do próprio elemento. Fonte única: space-state.ts.
  const resolved = resolveObjectStyle(object);
  const stroke = isSelected ? "#2563eb" : (resolved.stroke ?? "#334155");
  const strokeWidth = isSelected ? 2 : (resolved.strokeWidth ?? 1);
  const opacity = dimmed
    ? (resolved.opacity ?? 1) * 0.2
    : (resolved.opacity ?? 1);

  // Célula de mobiliário: cor por prateleiras negociadas + badge "X/Y".
  const fixture = readFixtureProps(object.properties);
  const shelfTotal = fixture ? Math.max(0, Math.round(fixture.shelfCount)) : 0;
  const shelfNegotiated = fixture
    ? Math.min(Math.max(0, Math.round(fixture.negotiatedShelves)), shelfTotal)
    : 0;
  const negLevel = fixture
    ? negotiationLevel(shelfNegotiated, shelfTotal)
    : "none";
  const negColors = NEGOTIATION_COLORS[negLevel];
  const fill = heatFill ?? negColors.cell ?? resolved.fill ?? "#cbd5e1";

  const hoverProps = {
    onMouseEnter: () => onHoverStart?.(object.id),
    onMouseLeave: () => onHoverEnd?.(),
  };

  const commonProps = {
    id: object.id,
    name: "mapObject",
    draggable,
    onMouseDown: handleSelect,
    onTap: handleSelect,
    strokeScaleEnabled: false,
    perfectDrawEnabled: false,
    stroke,
    strokeWidth,
    opacity,
    ...hoverProps,
  };

  const geometry = object.geometry;

  // Rótulo (nome) centralizado nos bounds do elemento. fontSize em metros escala
  // junto com o mapa; listening=false para não roubar o clique da forma. O stage
  // controla showLabel por zoom, evitando texto ilegível e custo de métrica.
  const bounds = boundsOf(geometry);
  const labelFont = object.style.fontSize ?? DEFAULT_LABEL_FONT_M;
  const label =
    showLabel && object.name ? (
      <Text
        text={object.name}
        x={bounds.minX}
        y={bounds.minY}
        width={Math.max(bounds.maxX - bounds.minX, labelFont)}
        height={Math.max(bounds.maxY - bounds.minY, labelFont)}
        align="center"
        verticalAlign="middle"
        fontSize={labelFont}
        fill={LABEL_COLOR}
        listening={false}
        perfectDrawEnabled={false}
      />
    ) : null;

  if (geometry.kind === "RECT") {
    return (
      <Group>
        <Rect
          {...commonProps}
          x={geometry.x}
          y={geometry.y}
          width={geometry.width}
          height={geometry.height}
          rotation={geometry.rotation}
          fill={fill}
          onDragMove={(event) => {
            const node = event.target;
            // Em grupo o próprio Transformer move as demais peças; só evitamos
            // o snap (encaixaria numa peça que também está se movendo).
            const { selectedIds } = useSceneStore.getState();
            if (selectedIds.length > 1 && selectedIds.includes(object.id)) {
              return;
            }
            if (geometry.rotation !== 0) return;
            applyDragSnap(node, {
              minX: node.x(),
              minY: node.y(),
              maxX: node.x() + geometry.width,
              maxY: node.y() + geometry.height,
            });
          }}
          onDragEnd={(event) => {
            clearGuides();
            // Cada peça grava a PRÓPRIA posição final — inclusive as do grupo,
            // que o Transformer moveu. Sem delta compartilhado, nada é aplicado
            // N vezes (o que antes jogava as gôndolas pra longe).
            updateObjectGeometry(object.id, {
              ...geometry,
              x: event.target.x(),
              y: event.target.y(),
            });
          }}
          onTransformEnd={(event) => {
            const node = event.target as Konva.Rect;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            updateObjectGeometry(object.id, {
              kind: "RECT",
              x: node.x(),
              y: node.y(),
              width: Math.max(0.1, geometry.width * scaleX),
              height: Math.max(0.1, geometry.height * scaleY),
              rotation: node.rotation(),
            });
          }}
        />
        {logoKey ? <CellLogo geometry={geometry} logoKey={logoKey} /> : null}
        {showLabel && object.name ? (
          <RectLabel
            geometry={geometry}
            name={object.name}
            fontSize={labelFont}
            hasBadge={Boolean(fixture && shelfTotal > 0)}
          />
        ) : null}
        {showLabel && fixture && shelfTotal > 0 ? (
          <ShelfBadge
            geometry={geometry}
            text={`${shelfNegotiated}/${shelfTotal}`}
            pill={negColors.pill}
          />
        ) : null}
      </Group>
    );
  }

  if (geometry.kind === "POINT") {
    return (
      <Group>
        <Circle
          {...commonProps}
          x={geometry.x}
          y={geometry.y}
          radius={0.25}
          fill={fill}
          onDragMove={(event) => {
            const node = event.target;
            applyDragSnap(node, {
              minX: node.x(),
              minY: node.y(),
              maxX: node.x(),
              maxY: node.y(),
            });
          }}
          onDragEnd={(event) => {
            clearGuides();
            updateObjectGeometry(object.id, {
              kind: "POINT",
              x: event.target.x(),
              y: event.target.y(),
            });
          }}
        />
        {label}
      </Group>
    );
  }

  const points = geometry.points.flatMap((point) => [point.x, point.y]);
  return (
    <Group>
      <Line
        {...commonProps}
        points={points}
        closed={geometry.kind === "POLYGON"}
        fill={geometry.kind === "POLYGON" ? fill : undefined}
        onDragEnd={(event) => {
          const dx = event.target.x();
          const dy = event.target.y();
          event.target.position({ x: 0, y: 0 });
          updateObjectGeometry(object.id, {
            ...geometry,
            points: geometry.points.map((point) => ({
              x: point.x + dx,
              y: point.y + dy,
            })),
          });
        }}
      />
      {label}
    </Group>
  );
}
