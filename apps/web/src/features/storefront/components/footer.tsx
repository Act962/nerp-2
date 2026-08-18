"use client";

import type { DeliveryMethod, PaymentMethod } from "@/generated/prisma/enums";
import { Mail, Phone, MapPin } from "lucide-react";
import { deliveryMethodsConfig, paymentMethodsConfig } from "../types/payments";
import { getContrastColor } from "@/utils/get-contrast-color";

interface Settings {
  theme: string | null;
  paymentMethodSettings: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  whatsappNumber: string | null;
  showWhatsapp: boolean;
  contactEmail: string | null;
  cep: string | null;
  address: string | null;
  district: string | null;
  number: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  youtube: string | null;
  kwai: string | null;
  deliverySpecialInfo: string | null;
}

interface FooterProps {
  settings: Settings;
}

export function Footer({ settings }: FooterProps) {
  const backgroundColor = settings.theme ?? "var(--accent-foreground)";
  const contrastColor = getContrastColor(backgroundColor);

  return (
    <footer className="border-t pt-10 pb-6 mt-10" style={{ backgroundColor }}>
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Pagamento */}
        <div>
          <h3 className="font-semibold mb-3" style={{ color: contrastColor }}>
            Formas de pagamento
          </h3>

          {settings.paymentMethodSettings.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {settings.paymentMethodSettings.map((method) => {
                const config =
                  paymentMethodsConfig[
                    method as keyof typeof paymentMethodsConfig
                  ];
                const IconComponent = config?.icon;

                return (
                  <li
                    key={method}
                    className="flex items-center space-x-3 rounded-lg "
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {IconComponent && (
                        <IconComponent
                          className="size-4 opacity-80"
                          stroke={contrastColor}
                        />
                      )}
                      <span
                        className="font-medium text-sm"
                        style={{ color: contrastColor }}
                      >
                        {config?.label || method}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p
              className="text-sm text-center py-4"
              style={{ color: contrastColor }}
            >
              Nenhum método de pagamento disponível no momento.
            </p>
          )}
        </div>

        {/* Entrega */}
        <div>
          <h3 className="font-semibold mb-3" style={{ color: contrastColor }}>
            Formas de envio
          </h3>

          {settings.deliveryMethods.length > 0 ? (
            <div className="flex flex-col gap-2">
              {settings.deliveryMethods.map((method) => {
                const config =
                  deliveryMethodsConfig[
                    method as keyof typeof deliveryMethodsConfig
                  ];
                const IconComponent = config?.icon;

                return (
                  <li key={method} className="flex items-center space-x-3">
                    <div className="flex items-center gap-3 flex-1">
                      {IconComponent && (
                        <IconComponent
                          className="size-4 opacity-80"
                          stroke={contrastColor}
                        />
                      )}
                      <span
                        className="font-medium text-sm"
                        style={{ color: contrastColor }}
                      >
                        {config?.label || method}
                      </span>
                    </div>
                  </li>
                );
              })}
            </div>
          ) : (
            <p
              className="text-sm text-center py-4"
              style={{ color: contrastColor }}
            >
              Nenhum método de envio disponível no momento.
            </p>
          )}

          {settings.deliverySpecialInfo && (
            <p
              className="text-xs mt-4 leading-relaxed opacity-70"
              style={{ color: contrastColor }}
            >
              {settings.deliverySpecialInfo}
            </p>
          )}
        </div>

        {/* Contato */}
        <div>
          <h3 className="font-semibold mb-3" style={{ color: contrastColor }}>
            Contato
          </h3>

          <div
            className="flex items-center gap-2 text-sm mb-2"
            style={{ color: contrastColor }}
          >
            <Mail size={18} stroke={contrastColor} /> {settings.contactEmail}
          </div>

          {settings.showWhatsapp && (
            <div
              className="flex items-center gap-2 text-sm mb-2"
              style={{ color: contrastColor }}
            >
              <Phone size={18} stroke={contrastColor} />{" "}
              {settings.whatsappNumber}
            </div>
          )}

          <div
            className="flex items-start gap-2 text-sm mb-2"
            style={{ color: contrastColor }}
          >
            <MapPin size={18} stroke={contrastColor} />
            <span>
              {settings.cep} {settings.district} {settings.address}{" "}
              {settings.number}
            </span>
          </div>
        </div>
      </div>

      <div
        className="text-center text-xs mt-10 opacity-70"
        style={{ color: contrastColor }}
      >
        ©2025. nERP. Todos os direitos reservados.
      </div>
    </footer>
  );
}
