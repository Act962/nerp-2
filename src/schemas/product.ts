import { ProductUnit } from "@/generated/prisma/enums";
import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(1, "Nome do produto é obrigatório"),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit: z.enum(ProductUnit).optional(),

  // Preços
  costPrice: z
    .number({ error: "Valor deve ser 0 ou maior" })
    .min(0, "Preço de custo deve ser maior ou igual a 0"),
  salePrice: z
    .number({ error: "Valor deve ser 0 ou maior" })
    .min(0, "Preço de venda deve ser maior ou igual a 0"),

  // Estoque
  currentStock: z.number().optional(),
  minStock: z.number().optional(),
  maxStock: z.number().optional(),
  location: z.string().optional(),

  // Imagens
  images: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),

  // Dimensões e peso
  weight: z.number().optional(),
  length: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),

  // Controle
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  trackStock: z.boolean().optional(),

  // KDS — tempo médio de preparo (min)
  prepTimeMinutes: z.number().int().positive().optional(),

  supplierId: z.string().optional(),

  // Cadastro fiscal (NFCe/NFe) — Fase B. Todos opcionais aqui; a validação
  // "obrigatório pra emitir" só rola no fluxo de emissão (Fase B.2).
  ncm: z.string().optional(),
  cest: z.string().optional(),
  cfop: z.string().optional(),
  origem: z.string().optional(),
  cstIcms: z.string().optional(),
  cstPis: z.string().optional(),
  cstCofins: z.string().optional(),
  aliqIcms: z.number().optional(),
  aliqPis: z.number().optional(),
  aliqCofins: z.number().optional(),
  cClassTrib: z.string().optional(),
});

export type ProductType = z.infer<typeof ProductSchema>;
