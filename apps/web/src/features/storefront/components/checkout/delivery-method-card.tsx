"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deliveryMethodsConfig } from "../../types/payments";

interface DeliveryMethodCardProps {
  availableDeliveryMethods: string[] | undefined;
  deliveryMethod: string;
  onDeliveryMethodChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
  deliverySpecialInfo?: string | null;
}

export function DeliveryMethodCard({
  availableDeliveryMethods,
  deliveryMethod,
  onDeliveryMethodChange,
  address,
  onAddressChange,
  deliverySpecialInfo,
}: DeliveryMethodCardProps) {
  const needsAddress = deliveryMethod === "DELIVERY_HOME";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Método de Entrega</CardTitle>
      </CardHeader>
      <CardContent>
        {availableDeliveryMethods && availableDeliveryMethods.length > 0 ? (
          <RadioGroup
            value={deliveryMethod}
            onValueChange={onDeliveryMethodChange}
          >
            {availableDeliveryMethods.map((method) => {
              const config =
                deliveryMethodsConfig[
                  method as keyof typeof deliveryMethodsConfig
                ];
              const IconComponent = config?.icon;

              return (
                <div
                  key={method}
                  className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <RadioGroupItem value={method} id={method} />
                  <Label
                    htmlFor={method}
                    className="flex items-center gap-3 cursor-pointer flex-1"
                  >
                    {IconComponent && (
                      <IconComponent className="h-5 w-5 opacity-60" />
                    )}
                    <div>
                      <p className="font-medium">{config?.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {config?.description}
                      </p>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum método de entrega disponível no momento.
          </p>
        )}

        {needsAddress && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="address">Endereço de Entrega</Label>
            <Textarea
              id="address"
              placeholder="Rua, número, bairro, complemento..."
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
            />
          </div>
        )}

        {deliverySpecialInfo && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {deliverySpecialInfo}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
