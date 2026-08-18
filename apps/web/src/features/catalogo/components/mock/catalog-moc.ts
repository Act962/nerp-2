import type { ComponentType, Dispatch, SetStateAction } from "react";
import { FreightChargeType, PaymentMethod } from "@/generated/prisma/enums";
import type { CatalogSettingsProps } from "@/features/catalogo/types/catalog-settings.types";

import { GeneralTab } from "@/features/catalogo/components/tab-general";
import { VisibilityTab } from "@/features/catalogo/components/tab-visibility";
import { OperationTab } from "@/features/catalogo/components/tab-operation";
import { TabContact } from "@/features/catalogo/components/tab-contact";
import { TabCustomization } from "@/features/catalogo/components/tab-customization";
import { TabDomain } from "@/features/catalogo/components/tab-domain";
import { TabPayment } from "@/features/catalogo/components/tab-payment";
import { TabDelivery } from "@/features/catalogo/components/tab-delivery";
import { TabSocial } from "@/features/catalogo/components/tab-social";
import { TabIntegration } from "@/features/catalogo/components/tab-integration";

export type TabProps = {
  settings: CatalogSettingsProps;
  setSettings: Dispatch<SetStateAction<CatalogSettingsProps | undefined>>;
};

export type TabEntry = {
  id: string;
  label: string;
  component: ComponentType<TabProps>;
};

export const tabs: TabEntry[] = [
  {
    id: "geral",
    label: "Geral",
    component: GeneralTab,
  },
  {
    id: "visibility",
    label: "Visibilidade",
    component: VisibilityTab,
  },
  {
    id: "operacao",
    label: "Operação",
    component: OperationTab,
  },
  {
    id: "contact",
    label: "Contato",
    component: TabContact,
  },
  {
    id: "customization",
    label: "Personalização",
    component: TabCustomization,
  },
  {
    id: "domain",
    label: "Site",
    component: TabDomain,
  },
  {
    id: "payment",
    label: "Pagamento",
    component: TabPayment,
  },
  {
    id: "delivery",
    label: "Entrega",
    component: TabDelivery,
  },
  {
    id: "social",
    label: "Redes Sociais",
    component: TabSocial,
  },
  {
    id: "integrations",
    label: "Integrações",
    component: TabIntegration,
  },
];

export const SORT_ORDER = [
  {
    id: 1,
    method: "ASC",
    label: "Em ordem alfabética crescente de A a Z",
  },
  {
    id: 2,
    method: "DESC",
    label: "Em ordem alfabética decrescente de Z a A",
  },
  {
    id: 3,
    method: "NEWEST",
    label: "Em ordem crescente de mais recente para mais antigo",
  },
  {
    id: 4,
    method: "OLDEST",
    label: "Em ordem decrescente de mais antigo para mais recente",
  },
];

export const payments = [
  { id: "1", name: "PIX", method: PaymentMethod.PIX },
  { id: "2", name: "Dinheiro", method: PaymentMethod.DINHEIRO },
  { id: "3", name: "Transferência", method: PaymentMethod.TRANSFERENCIA },
  { id: "4", name: "Cartão de crédito", method: PaymentMethod.CREDITO },
  { id: "5", name: "Cartão de débito", method: PaymentMethod.DEBITO },
  { id: "6", name: "Boleto", method: PaymentMethod.BOLETO },
  { id: "7", name: "Link de pagamento", method: PaymentMethod.OUTROS },
];

export const freightOptions = [
  { id: "1", method: "NEGOTIATE_WHATSAPP", name: "Combinar via whatsapp" },
  { id: "2", method: "NEGOTIATE_FREIGHT", name: "Combinar valor de frete" },
  { id: "3", method: "FREE_SHIPPING", name: "Frete grátis" },
  { id: "4", method: "NO_SHIPPING", name: "Não oferecer frete" },
];

export const deliveryMethods = [
  { id: "1", method: "DELIVERY_HOME", name: "Entrega em domicílio" },
  { id: "2", method: "PICKUP_STORE", name: "Retirada na loja" },
  { id: "3", method: "ROOM_SERVICE", name: "Serviço de quarto" },
  { id: "4", method: "DIGITAL_DELIVERY", name: "Entrega digital" },
];

export const colors = [
  "#f44336",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#00bcd4",
  "#009688",
  "#4caf50",
  "#8bc34a",
  "#cddc39",
  "#ffeb3b",
  "#ffc107",
  "#ff9800",
  "#ff5722",
  "#795548",
  "#607d8b",
];

export const freightCharges = [
  { id: "1", name: "Fixo por pedido ", method: FreightChargeType.FIXED },
  { id: "2", name: "Valor por quilograma", method: FreightChargeType.PER_KG },
];
