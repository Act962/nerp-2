import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { phoneMask } from "@/utils/format-phone";
import { CatalogSettingsProps } from "./catalog";

interface ContactTabProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

export function TabContact({ settings, setSettings }: ContactTabProps) {
  const formatCEP = (value = "") => {
    return value
      .replace(/\D/g, "") // remove tudo que não for número
      .replace(/(\d{5})(\d)/, "$1-$2") // adiciona o hífen após 5 números
      .slice(0, 9); // limita no máximo a 9 caracteres (xxxxx-xxx)
  };
  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Contato</h2>
        <p className="text-sm text-muted-foreground">
          Configure os canais de comunicação
        </p>
      </div>

      <Card className="p-y-6">
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="whatsappNumber">Número do WhatsApp</Label>
            <Input
              id="whatsappNumber"
              placeholder="Ex: +55 11 98765-4321"
              value={settings.whatsappNumber}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  whatsappNumber: phoneMask(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Formato: DDD + número
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-6">
            <div className="space-y-0.5">
              <Label htmlFor="showWhatsapp" className="text-base font-medium">
                Exibir WhatsApp
              </Label>
              <p className="text-sm text-muted-foreground">
                Mostra o botão do WhatsApp no catálogo
              </p>
            </div>
            <Switch
              id="showWhatsapp"
              checked={settings.showWhatsapp}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  showWhatsapp: checked,
                })
              }
            />
          </div>
          <div className="space-y-2 border-t border-border pt-6">
            <Label htmlFor="contactEmail">Email de Contato</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="contato@exemplo.com.br"
              value={settings.contactEmail}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  contactEmail: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-3 border-border border-t pt-6">
            <h2 className="text-lg font-semibold text-foreground">
              Endereço da loja (opcional)
            </h2>

            <p className="text-sm text-muted-foreground max-w-lg">
              Este é o endereço que seus clientes verão em seu catálogo. Se
              estiver correto, um mapa será exibido ao lado do endereço.
            </p>
            <div className="space-y-4 md:space-y-2">
              <div className="grid grid-cols-1 space-y-4 md:space-y-0 md:grid-cols-3 space-x-4 ">
                <div className="space-y-1">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    value={formatCEP(settings.cep)}
                    onChange={(e) =>
                      setSettings({ ...settings, cep: e.target.value })
                    }
                    id="cep"
                    placeholder="CEP"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    value={settings.address}
                    onChange={(e) =>
                      setSettings({ ...settings, address: e.target.value })
                    }
                    id="address"
                    placeholder="Rua, Avenida..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 space-y-4 md:space-y-0 md:grid-cols-3 space-x-4 ">
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="district">Bairro</Label>
                  <Input
                    value={settings.district}
                    onChange={(e) =>
                      setSettings({ ...settings, district: e.target.value })
                    }
                    id="district"
                    placeholder="Bairro"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="number">Número</Label>
                  <Input
                    value={settings.number}
                    onChange={(e) =>
                      setSettings({ ...settings, number: e.target.value })
                    }
                    id="number"
                    placeholder="Número"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
