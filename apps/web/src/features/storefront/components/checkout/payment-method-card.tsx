"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { paymentMethodsConfig } from "../../types/payments";

interface PaymentMethodCardProps {
  availablePaymentMethods: string[] | undefined;
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
}

export function PaymentMethodCard({
  availablePaymentMethods,
  paymentMethod,
  onPaymentMethodChange,
}: PaymentMethodCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        {availablePaymentMethods && availablePaymentMethods.length > 0 ? (
          <RadioGroup
            value={paymentMethod}
            onValueChange={onPaymentMethodChange}
          >
            {availablePaymentMethods.map((method) => {
              const config =
                paymentMethodsConfig[
                  method as keyof typeof paymentMethodsConfig
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
                    <span className="font-medium">
                      {config?.label || method}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum método de pagamento disponível no momento.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
