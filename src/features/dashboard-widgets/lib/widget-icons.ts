import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Clock,
  DollarSign,
  type LucideIcon,
  MapPin,
  Package,
  Percent,
  ShoppingCart,
  Target,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

// Lista curada — "sempre um destes ícones" é restrição do produto, mesmo
// espírito da paleta pastel fixa em pastel-colors.ts. A key é o que persiste
// em DashboardWidget.icon; o componente nunca muda de significado depois de
// escolhido.
export const WIDGET_ICONS = [
  { key: "TrendingUp", label: "Tendência", Icon: TrendingUp },
  { key: "DollarSign", label: "Cifrão", Icon: DollarSign },
  { key: "ShoppingCart", label: "Carrinho", Icon: ShoppingCart },
  { key: "Package", label: "Pacote", Icon: Package },
  { key: "Truck", label: "Caminhão", Icon: Truck },
  { key: "Users", label: "Pessoas", Icon: Users },
  { key: "Target", label: "Meta", Icon: Target },
  { key: "AlertTriangle", label: "Alerta", Icon: AlertTriangle },
  { key: "BarChart3", label: "Gráfico", Icon: BarChart3 },
  { key: "Percent", label: "Percentual", Icon: Percent },
  { key: "Clock", label: "Horário", Icon: Clock },
  { key: "MapPin", label: "Localização", Icon: MapPin },
  { key: "Boxes", label: "Estoque", Icon: Boxes },
  { key: "Wallet", label: "Carteira", Icon: Wallet },
] as const satisfies { key: string; label: string; Icon: LucideIcon }[];

export type WidgetIconKey = (typeof WIDGET_ICONS)[number]["key"];

const ICON_BY_KEY = new Map<string, LucideIcon>(
  WIDGET_ICONS.map((icon) => [icon.key, icon.Icon]),
);

export function widgetIcon(key: string | null | undefined): LucideIcon | null {
  if (!key) return null;
  return ICON_BY_KEY.get(key) ?? null;
}
