"use client";

import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Mail,
  Phone,
  MapPin,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  File,
} from "lucide-react";
import { paymentMethodsConfig } from "../types/payments";
import Link from "next/link";
import { formatCNPJ } from "@/utils/format-cnpj";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AboutUsProps {
  subdomain: string;
}

export function AboutUs({ subdomain }: AboutUsProps) {
  const { data } = useSuspenseQuery(
    orpc.catalogSettings.public.queryOptions({
      input: {
        subdomain: subdomain,
      },
    }),
  );

  const { catalogSettings } = data;

  const socialNetworks = [
    {
      key: "instagram",
      value: catalogSettings.instagram,
      Icon: Instagram,
      color: "bg-pink-500 hover:bg-pink-400",
    },
    {
      key: "facebook",
      value: catalogSettings.facebook,
      Icon: Facebook,
      color: "bg-blue-600 hover:bg-blue-500",
    },
    {
      key: "twitter",
      value: catalogSettings.twitter,
      Icon: Twitter,
      color: "bg-sky-500 hover:bg-sky-400",
    },
    {
      key: "youtube",
      value: catalogSettings.youtube,
      Icon: Youtube,
      color: "bg-red-600 hover:bg-red-500",
    },
  ];
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* CARD SOBRE NÓS */}
      <div className="bg-white shadow rounded-xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <Avatar className="w-24 h-24">
            <AvatarImage src={catalogSettings.logo ?? undefined} />
            <AvatarFallback className="text-3xl font-semibold">
              {catalogSettings.metaTitle?.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        </div>

        <p className="text-gray-600 text-2xl font-medium">
          {catalogSettings.metaTitle}
        </p>
        {catalogSettings.aboutText && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700">Sobre nós</h2>

            <p className="leading-relaxed text-gray-700 text-sm">
              {catalogSettings.aboutText}
            </p>
          </div>
        )}

        <div className="pt-4">
          <p className="text-sm font-medium mb-3 text-gray-700">
            Siga nossas redes
          </p>
          <div className="flex justify-center gap-3">
            {socialNetworks.map(
              ({ key, value, Icon, color }) =>
                value && (
                  <Link
                    key={key}
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center text-white w-10 h-10 rounded-full shadow transition ${color}`}
                  >
                    <Icon size={22} />
                  </Link>
                ),
            )}
          </div>
        </div>
      </div>

      {/* CARD PAGAMENTO */}
      <div className="bg-white shadow rounded-xl p-8 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">
          Formas de pagamento oferecidas
        </h3>

        {catalogSettings.paymentMethodSettings.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {catalogSettings.paymentMethodSettings.map((method) => {
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
                      <IconComponent className="size-5 text-gray-700 opacity-80" />
                    )}
                    <span className="font-medium text-sm text-gray-700">
                      {config?.label || method}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-center py-4">
            Nenhum método de pagamento disponível no momento.
          </p>
        )}
      </div>

      {/* CARD CONTATO */}
      <div className="bg-white shadow rounded-xl p-8 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Contato</h3>

        {catalogSettings.showWhatsapp && (
          <span className="flex items-center font-medium gap-2 text-sm text-gray-700">
            <Phone size={18} /> {catalogSettings.whatsappNumber}
          </span>
        )}

        <span className="flex items-center font-medium gap-2 text-sm text-gray-700">
          <Mail size={18} /> {catalogSettings.contactEmail}
        </span>
        <span className="flex items-center font-medium gap-2 text-sm text-gray-700">
          <File size={18} /> {formatCNPJ(catalogSettings.cnpj ?? "")}
        </span>

        <span className="flex items-start font-medium gap-2 text-sm text-gray-700">
          <MapPin size={18} />
          <span>
            {" "}
            {catalogSettings.cep} {catalogSettings.district}{" "}
            {catalogSettings.address} {catalogSettings.number}
          </span>
        </span>

        {/* <div className="mt-4 w-full h-40 rounded overflow-hidden">
          <iframe
            src={catalogSettings.mapEmbed}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div> */}
      </div>
    </div>
  );
}
