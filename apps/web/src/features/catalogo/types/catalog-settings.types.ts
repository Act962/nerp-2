import type { CatalogSettingsModel } from "@/generated/prisma/models/CatalogSettings";

/**
 * Tipo do formulário de configurações do catálogo.
 *
 * Derivado diretamente do modelo Prisma `CatalogSettings`, com as seguintes adaptações
 * necessárias para o contexto do formulário React:
 *
 * - Campos `nullable` do Prisma (ex: `string | null`) → `string` (usa `""` como fallback)
 * - Campos `Decimal` do Prisma (frete) → `number` (convertidos no endpoint `list.ts`)
 * - `whatsappNumber`: sobrescrito para `string` (recebe máscara de telefone no estado)
 * - `walletId`: campo extra do formulário (não existe no modelo Prisma ainda, vive no input do update)
 *
 * Ao adicionar um novo campo em `update.ts`, adicione-o também aqui para manter
 * o formulário e o backend sincronizados.
 */
export type CatalogSettingsProps = Omit<
  CatalogSettingsModel,
  // Campos excluídos do estado do formulário (metadados do banco)
  | "createdAt"
  | "updatedAt"
  | "stripeKey"
  // Anulamos os nullable e Decimal para substituir pelas versões adaptadas abaixo
  | "whatsappNumber"
  | "contactEmail"
  | "metaTitle"
  | "metaDescription"
  | "logo"
  | "aboutText"
  | "theme"
  | "instagram"
  | "facebook"
  | "twitter"
  | "tiktok"
  | "youtube"
  | "kwai"
  | "cep"
  | "address"
  | "district"
  | "number"
  | "id_meta"
  | "pixel_meta"
  | "deliverySpecialInfo"
  | "cnpj"
  | "freightFixedValue"
  | "freightValuePerKg"
  | "freeShippingMinValue"
> & {
  // Nullable → string (formulário usa string vazia como fallback)
  whatsappNumber: string;
  contactEmail: string;
  metaTitle: string;
  metaDescription: string;
  logo: string;
  aboutText: string;
  theme: string;
  instagram: string;
  facebook: string;
  twitter: string;
  tiktok: string;
  youtube: string;
  kwai: string;
  cep: string;
  address: string;
  district: string;
  number: string;
  id_meta: string;
  pixel_meta: string;
  deliverySpecialInfo: string;
  cnpj: string;
  // Decimal → number (convertido no list.ts via Number())
  freightFixedValue: number;
  freightValuePerKg: number;
  freeShippingMinValue: number;
  // Campo extra do formulário (mapeado para walletId no backend)
  walletId: string;
};
