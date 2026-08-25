import type { MapAnnotationType } from "@/generated/prisma/enums";

export interface AnnotationTypeMeta {
  label: string;
  color: string;
}

export const ANNOTATION_META: Record<MapAnnotationType, AnnotationTypeMeta> = {
  PIN: { label: "Pin", color: "#6366f1" },
  COMMENT: { label: "Comentário", color: "#0ea5e9" },
  ALERT: { label: "Alerta", color: "#ef4444" },
  PENDING: { label: "Pendência", color: "#f59e0b" },
};

export const ANNOTATION_TYPES: MapAnnotationType[] = [
  "PIN",
  "COMMENT",
  "ALERT",
  "PENDING",
];
