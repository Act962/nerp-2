import {
  ChefHat,
  LayoutGrid,
  Store,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { CatalogLayout, CatalogOperationMode } from "@/generated/prisma/enums";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CatalogSettingsProps } from "./catalog";

interface OperationTabProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

const MODES = [
  {
    mode: CatalogOperationMode.MARKETPLACE,
    icon: Store,
    title: "Marketplace padrão",
    description:
      "E-commerce de varejo. O pagamento registra apenas a venda. Nada é enviado à cozinha.",
  },
  {
    mode: CatalogOperationMode.KITCHEN,
    icon: ChefHat,
    title: "Cozinha",
    description:
      "Restaurante/food. Ao confirmar o pagamento, cada item do pedido aparece automaticamente no painel da cozinha (KDS).",
  },
  {
    mode: CatalogOperationMode.APPROVAL,
    icon: ShoppingBag,
    title: "Aprovação presencial",
    description:
      "O cliente monta o pedido no catálogo e vai à loja pagar. O pedido cai como novo na tela do PDV (/vendas/novo); o operador aprova e finaliza a venda presencialmente. Não integra pagamento online.",
  },
] as const;

// Leiaute é como a vitrine se DESENHA; modo de operação é o que acontece DEPOIS
// do checkout. São coisas independentes de propósito: uma padaria pode querer
// cardápio com aprovação presencial, e um mercado, lista com pagamento online.
const LAYOUTS = [
  {
    layout: CatalogLayout.LISTA,
    icon: LayoutGrid,
    title: "Lista",
    description:
      "A vitrine de e-commerce: grade de produtos, filtros e página de detalhe. Boa para catálogo grande.",
  },
  {
    layout: CatalogLayout.CARDAPIO,
    icon: UtensilsCrossed,
    title: "Cardápio",
    description:
      "Tela de comida no celular: foto grande, categorias em faixa, botão de adicionar no próprio card e a sacola fixa no rodapé. O cliente pede sem se cadastrar.",
  },
] as const;

export function OperationTab({ settings, setSettings }: OperationTabProps) {
  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Modo de operação
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha o cenário do seu catálogo. Define o que acontece quando um
          cliente paga um pedido.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map(({ mode, icon: Icon, title, description }) => {
          const selected = settings.operationMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={selected}
              onClick={() => setSettings({ ...settings, operationMode: mode })}
              className="text-left outline-none"
            >
              <Card
                className={cn(
                  "h-full cursor-pointer p-6 transition-colors",
                  selected
                    ? "border-primary ring-2 ring-primary"
                    : "hover:border-muted-foreground/40",
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-medium text-foreground">
                      {title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <h2 className="text-xl font-semibold text-foreground">
          Leiaute da vitrine
        </h2>
        <p className="text-sm text-muted-foreground">
          Como a loja se desenha para quem abre o link. Não muda o que acontece
          no pagamento.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LAYOUTS.map(({ layout, icon: Icon, title, description }) => {
          const selected = settings.layout === layout;
          return (
            <button
              key={layout}
              type="button"
              aria-pressed={selected}
              onClick={() => setSettings({ ...settings, layout })}
              className="text-left outline-none"
            >
              <Card
                className={cn(
                  "h-full cursor-pointer p-6 transition-colors",
                  selected
                    ? "border-primary ring-2 ring-primary"
                    : "hover:border-muted-foreground/40",
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-medium text-foreground">
                      {title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
