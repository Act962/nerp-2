import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { payments } from "./mock/catalog-moc";
import { CatalogSettingsProps } from "./catalog";

interface TabPaymentProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

export function TabPayment({ settings, setSettings }: TabPaymentProps) {
  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Configure as opções de pagamento do seu catálogo
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <h2 className="text-lg font-semibold text-foreground">
            Formas de pagamento disponíveis
          </h2>

          <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-2">
                <Checkbox
                  id={payment.method}
                  checked={settings.paymentMethodSettings.includes(
                    payment.method,
                  )}
                  onCheckedChange={(value) =>
                    setSettings({
                      ...settings,
                      paymentMethodSettings: value
                        ? [...settings.paymentMethodSettings, payment.method]
                        : settings.paymentMethodSettings.filter(
                            (payment) => payment !== payment,
                          ),
                    })
                  }
                />
                <Label
                  className="text-sm text-muted-foreground"
                  htmlFor={payment.method}
                >
                  {payment.name}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
