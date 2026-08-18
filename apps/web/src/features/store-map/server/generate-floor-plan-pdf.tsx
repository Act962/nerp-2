import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { v4 as uuidv4 } from "uuid";
import type { Geometry, MapObjectStyle } from "@/features/store-map/engine/types";
import prisma from "@/lib/db";
import { uploadBufferToR2 } from "@/lib/upload-buffer-to-r2";
import {
  NEGOTIABLE_TYPES,
  SPACE_STATE_META,
  SPACE_STATE_ORDER,
} from "../engine/space-state";
import {
  FloorPlanDocument,
  type FloorPlanPdfData,
  type FloorPlanPdfObject,
} from "../pdf/floor-plan-document";

const STRUCTURAL_FILL = "#e2e8f0";
const STRUCTURAL_STROKE = "#94a3b8";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function toPdfObject(
  geometry: Geometry,
  fill: string,
  stroke: string,
  label: string | null,
): FloorPlanPdfObject {
  const base = { fill, stroke, label, x: 0, y: 0, width: 0, height: 0, points: [] as number[] };
  if (geometry.kind === "RECT") {
    return {
      ...base,
      kind: "RECT",
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
    };
  }
  if (geometry.kind === "POINT") {
    return { ...base, kind: "POINT", x: geometry.x, y: geometry.y };
  }
  return {
    ...base,
    kind: geometry.kind,
    points: geometry.points.flatMap((point) => [point.x, point.y]),
  };
}

export async function generateFloorPlanPdf(
  floorPlanId: string,
  organizationId: string,
): Promise<string> {
  const floorPlan = await prisma.floorPlan.findFirst({
    where: { id: floorPlanId, organizationId },
    select: {
      id: true,
      name: true,
      widthM: true,
      heightM: true,
      store: { select: { name: true } },
      objects: {
        orderBy: { z: "asc" },
        select: {
          type: true,
          geometry: true,
          style: true,
          name: true,
          spaceCode: true,
          spaceState: true,
          supplier: { select: { name: true } },
          brand: { select: { name: true } },
        },
      },
    },
  });

  if (!floorPlan) throw new Error("Mapa não encontrado");

  const objects: FloorPlanPdfObject[] = floorPlan.objects.map((object) => {
    const geometry = object.geometry as unknown as Geometry;
    const style = (object.style as MapObjectStyle | null) ?? {};
    const isNegotiable = NEGOTIABLE_TYPES.has(object.type);
    const meta = SPACE_STATE_META[object.spaceState];
    const fill = isNegotiable ? meta.fill : (style.fill ?? STRUCTURAL_FILL);
    const stroke = isNegotiable
      ? meta.stroke
      : (style.stroke ?? STRUCTURAL_STROKE);
    return toPdfObject(geometry, fill, stroke, object.name);
  });

  // Só espaços negociáveis vão pra tabela — é o que interessa comercialmente.
  const spaces = floorPlan.objects
    .filter((object) => NEGOTIABLE_TYPES.has(object.type))
    .map((object) => {
      const meta = SPACE_STATE_META[object.spaceState];
      const occupant =
        object.brand?.name ?? object.supplier?.name ?? null;
      return {
        spaceCode: object.spaceCode,
        name: object.name,
        stateLabel: meta.label,
        stateColor: meta.stroke,
        occupant,
      };
    });

  const legend = SPACE_STATE_ORDER.map((state) => ({
    label: SPACE_STATE_META[state].label,
    color: SPACE_STATE_META[state].fill,
  }));

  const data: FloorPlanPdfData = {
    planName: floorPlan.name,
    storeName: floorPlan.store.name,
    widthM: floorPlan.widthM,
    heightM: floorPlan.heightM,
    objects,
    spaces,
    legend,
    generatedAt: dateFormatter.format(new Date()),
  };

  const buffer = await renderToBuffer(<FloorPlanDocument data={data} />);
  const key = `floor-plans/${floorPlanId}-${uuidv4()}.pdf`;
  await uploadBufferToR2(key, Buffer.from(buffer), "application/pdf");
  return key;
}
