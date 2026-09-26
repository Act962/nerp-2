import type { CatalogOrigin } from "@/features/pedidos/utils/catalog-order-status";
import type { PaymentMethod } from "@/generated/prisma/enums";

type OriginConfig = {
  label: string;
  description: string;
  badgeClassName: string;
};

// Uma cor por origem: no meio de três colunas cheias, é a cor que diz de
// relance se o pedido pede ação da loja ou é só acompanhamento.
export const ORIGIN_CONFIG: Record<CatalogOrigin, OriginConfig> = {
  CATALOGO_APROVACAO: {
    label: "Aprovação",
    description: "A loja confirma e finaliza a venda no PDV.",
    badgeClassName:
      "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  },
  CATALOGO_ORBITA: {
    label: "Órbita",
    description: "O Astro negocia e cobra no Órbita. Aqui é só acompanhamento.",
    badgeClassName:
      "border-transparent bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200",
  },
  CATALOGO_COZINHA: {
    label: "Cozinha",
    description: "Vai direto para o quadro da cozinha.",
    badgeClassName:
      "border-transparent bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200",
  },
  CATALOGO_MARKETPLACE: {
    label: "Marketplace",
    description: "Pago online no checkout do catálogo.",
    badgeClassName:
      "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  DINHEIRO: "Dinheiro",
  CREDITO: "Crédito",
  DEBITO: "Débito",
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  OUTROS: "Outros",
};

/** Link de WhatsApp para telefone brasileiro guardado com ou sem DDI. */
export function whatsappHref(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}
