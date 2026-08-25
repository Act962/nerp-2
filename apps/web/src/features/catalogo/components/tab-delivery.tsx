"use client";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  deliveryMethods,
  freightCharges,
  freightOptions,
} from "./mock/catalog-moc";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CatalogSettingsProps } from "./catalog";
import {
  DeliveryMethod,
  FreightChargeType,
  FreightOption,
} from "@/generated/prisma/enums";
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from "@/utils/currency-formatter";

interface TabDeliveryProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

export function TabDelivery({ settings, setSettings }: TabDeliveryProps) {
  return (
    <div className="space-y-6 mt-4">
      <div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">Entrega</h2>
          <p className="text-sm text-muted-foreground">
            Configure as opções de entrega do seu catálogo
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-2">
        <div className="space-y-3">
          <Label>Formas de entrega disponíveis</Label>
          <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
            {deliveryMethods.map((deliveryMethod) => (
              <div key={deliveryMethod.id} className="flex items-center gap-2">
                <Checkbox
                  id={deliveryMethod.id}
                  checked={settings.deliveryMethods.includes(
                    deliveryMethod.method as DeliveryMethod,
                  )}
                  onCheckedChange={(value) =>
                    setSettings({
                      ...settings,
                      deliveryMethods: value
                        ? [
                            ...settings.deliveryMethods,
                            deliveryMethod.method as DeliveryMethod,
                          ]
                        : settings.deliveryMethods.filter(
                            (deliveryMethod) =>
                              deliveryMethod !== deliveryMethod,
                          ),
                    })
                  }
                />
                <Label
                  className="text-sm text-muted-foreground"
                  htmlFor={deliveryMethod.name}
                >
                  {deliveryMethod.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Label htmlFor="info-delivery">
            Informações especiais sobre entrega e envio
          </Label>
          <div className="gap-x-5 gap-y-2">
            <Textarea
              id="info-delivery"
              rows={6}
              className="text-sm resize-none"
              placeholder="Insira aqui informações importantes sobre a entrega que você gostaria que seus clientes soubessem. Ex: Frete grátis a partir de R$200,00"
              value={settings.deliverySpecialInfo}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  deliverySpecialInfo: e.target.value,
                })
              }
            />
          </div>
        </div>
        <div className="space-y-3">
          <Label>Configuração de Precificação do Frete</Label>
          <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
            {freightOptions.map((freightOption) => (
              <div
                key={freightOption.id}
                className="flex items-center gap-2"
                onClick={() =>
                  setSettings({
                    ...settings,
                    freightOptions: freightOption.method as FreightOption,
                  })
                }
              >
                <Checkbox
                  checked={settings.freightOptions == freightOption.method}
                  id={freightOption.name}
                />
                <Label
                  className="text-sm text-muted-foreground"
                  htmlFor={freightOption.name}
                >
                  {freightOption.name}
                </Label>
              </div>
            ))}
          </div>
          {settings.freightOptions === FreightOption.NEGOTIATE_FREIGHT && (
            <div className="space-y-6">
              <div className="space-y-3 mt-2">
                <Label>Como deve ser cobrado o valor do frete:</Label>

                <RadioGroup
                  defaultValue={settings.freightChargeType}
                  className="flex gap-6"
                >
                  {freightCharges.map((freightCharge) => (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={freightCharge.method}
                        id={freightCharge.method}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            freightChargeType:
                              freightCharge.method as FreightChargeType,
                          })
                        }
                      />
                      <Label
                        className="text-sm text-muted-foreground"
                        htmlFor={freightCharge.method}
                      >
                        {freightCharge.name}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="R$ 0,00"
                    className="w-32"
                    value={
                      settings.freightChargeType === FreightChargeType.PER_KG
                        ? settings.freightValuePerKg
                        : settings.freightFixedValue
                    }
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ...(settings.freightChargeType ===
                        FreightChargeType.PER_KG
                          ? { freightValuePerKg: Number(e.target.value) }
                          : { freightFixedValue: Number(e.target.value) }),
                      })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {settings.freightChargeType === FreightChargeType.PER_KG
                      ? "Por quilo"
                      : "Fixo por pedido"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <Label className="font-medium">Mais opções:</Label>

                <div className="flex items-center justify-between">
                  <Label
                    className="text-sm text-muted-foreground"
                    htmlFor="moreOptions"
                  >
                    Frete grátis a partir de um valor
                  </Label>
                  <Switch
                    id="moreOptions"
                    checked={settings.freeShippingEnabled}
                    onCheckedChange={(value) =>
                      setSettings({
                        ...settings,
                        freeShippingEnabled: value,
                      })
                    }
                  />
                </div>

                {settings.freeShippingEnabled && (
                  <Input
                    placeholder="0,00"
                    className="w-40"
                    inputMode="numeric"
                    value={formatCurrencyInput(
                      String(settings.freeShippingMinValue * 100),
                    )}
                    onChange={(e) => {
                      const numericValue = parseCurrencyInput(e.target.value);
                      setSettings({
                        ...settings,
                        freeShippingMinValue: numericValue,
                      });
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
