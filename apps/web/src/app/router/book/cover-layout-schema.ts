import { z } from "zod";

const baseElementSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
});

const fontFamilySchema = z
  .enum(["Helvetica", "Times-Roman", "Courier"])
  .optional();

const textElementSchema = baseElementSchema.extend({
  type: z.literal("text"),
  text: z.string(),
  fontSize: z.number(),
  color: z.string(),
  fontWeight: z.enum(["normal", "bold"]),
  align: z.enum(["left", "center", "right"]),
  uppercase: z.boolean(),
  fontFamily: fontFamilySchema,
  photoRef: z.number().int().min(0).optional(),
});

const imageElementSchema = baseElementSchema.extend({
  type: z.literal("image"),
  imageKey: z.string(),
  imageSource: z.enum(["upload", "organization", "supplier"]).optional(),
  objectFit: z.enum(["contain", "cover"]),
});

const dividerElementSchema = baseElementSchema.extend({
  type: z.literal("divider"),
  color: z.string(),
});

const shapeElementSchema = baseElementSchema.extend({
  type: z.literal("shape"),
  shape: z.enum(["rect", "rounded", "circle", "triangle"]),
  fill: z.string(),
  fillOpacity: z.number().min(0).max(1),
  strokeColor: z.string(),
  strokeWidth: z.number().min(0),
  text: z.string(),
  fontSize: z.number(),
  fontColor: z.string(),
  fontFamily: fontFamilySchema,
  fontWeight: z.enum(["normal", "bold"]),
});

const photoSlotElementSchema = baseElementSchema.extend({
  type: z.literal("photoSlot"),
  slotIndex: z.number().int().min(0),
  objectFit: z.enum(["contain", "cover"]),
  cornerRadius: z.number().min(0),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).optional(),
  strokeDashed: z.boolean().optional(),
  imageScale: z.number().min(0.1).max(4).optional(),
  imageOffsetX: z.number().min(0).max(100).optional(),
  imageOffsetY: z.number().min(0).max(100).optional(),
  showNumber: z.boolean().optional(),
});

export const coverElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  dividerElementSchema,
  shapeElementSchema,
  photoSlotElementSchema,
]);

export const coverLayoutSchema = z.array(coverElementSchema);

export const coverBackgroundSchema = z.object({
  color: z.string(),
  opacity: z.number().min(0).max(1),
  imageKey: z.string().nullable().optional(),
});

export const nullableCoverLayoutSchema = coverLayoutSchema.nullable();
export const nullableCoverBackgroundSchema = coverBackgroundSchema.nullable();
