import { CatalogSettingsProps } from "./catalog";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SORT_ORDER } from "./mock/catalog-moc";
import { CatalogSortOrder } from "@/generated/prisma/enums";

interface VisibilityTabProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

export function VisibilityTab({ settings, setSettings }: VisibilityTabProps) {
  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Visibilidade</h2>
        <p className="text-sm text-muted-foreground">
          Controle o que é exibido no seu catálogo
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-base font-medium">
                Catálogo Ativo
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite que visitantes acessem o catálogo
              </p>
            </div>
            <Switch
              id="isActive"
              checked={settings.isActive}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  isActive: checked,
                })
              }
            />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-6">
            <div className="space-y-0.5">
              <Label
                htmlFor="showProductWithoutStock"
                className="text-base font-medium"
              >
                Mostrar Produtos fora do estoque
              </Label>
              <p className="text-sm text-muted-foreground">
                Exibe os produtos que estão fora do estoque
              </p>
            </div>
            <Switch
              id="showProductWithoutStock"
              checked={settings.showProductWithoutStock}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  showProductWithoutStock: checked,
                })
              }
            />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-6">
            <div className="space-y-0.5">
              <Label htmlFor="showStock" className="text-base font-medium">
                Mostrar Estoque
              </Label>
              <p className="text-sm text-muted-foreground">
                Exibe a quantidade disponível em estoque
              </p>
            </div>
            <Switch
              id="showStock"
              checked={settings.showStock}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  showStock: checked,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-6">
            <div className="space-y-0.5">
              <Label htmlFor="allowOrders" className="text-base font-medium">
                Permitir Pedidos
              </Label>
              <p className="text-sm text-muted-foreground">
                Habilita o botão de fazer pedido
              </p>
            </div>
            <Switch
              id="allowOrders"
              checked={settings.allowOrders}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  allowOrders: checked,
                })
              }
            />
          </div>
          <div className="flex flex-col border-t border-border pt-6">
            <div className="space-y-0.5">
              <Label htmlFor="showPrices" className="text-base font-medium">
                Ordem de exibição de produtos
              </Label>
              <p className="text-sm text-muted-foreground">
                Defina como deve ser a ordem de exivição dos seus produtos no
                seu catálogo
              </p>
            </div>
            <div className="mt-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {
                      SORT_ORDER.find(
                        (order) => order.method === settings.sortOrder,
                      )?.label
                    }
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  {SORT_ORDER.map((order) => (
                    <div key={order.id}>
                      <DropdownMenuCheckboxItem
                        onCheckedChange={() =>
                          setSettings({
                            ...settings,
                            sortOrder: order.method as CatalogSortOrder,
                          })
                        }
                      >
                        {order.label}
                      </DropdownMenuCheckboxItem>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
