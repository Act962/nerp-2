"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { phoneMask, normalizePhone } from "@/utils/format-phone";

import { tabs } from "@/features/catalogo/components/mock/catalog-moc";
import {
  updateFieldCatalog,
  useCatalogSettingsPrivate,
} from "@/features/storefront/hooks/use-catalog-settings";

import type { CatalogSettingsProps } from "@/features/catalogo/types/catalog-settings.types";
import { EmptyCatalog } from "./empty-catalog";

// Re-exporta para uso nos componentes filhos (tab-*)
export type { CatalogSettingsProps };

export function CatalogSettings() {
  const { data, isLoading } = useCatalogSettingsPrivate();
  const useUpdateFieldsCatalogSettings = updateFieldCatalog();
  const [settings, setSettings] = useState<CatalogSettingsProps>();

  useEffect(() => {
    if (!data) return;

    setSettings({
      id: data.id,
      organizationId: data.organizationId,
      isActive: data.isActive,
      showPrices: data.showPrices,
      showStock: data.showStock,
      allowOrders: data.allowOrders,
      showProductWithoutStock: data.showProductWithoutStock,
      sortOrder: data.sortOrder,
      operationMode: data.operationMode,
      whatsappNumber: phoneMask(String(data.whatsappNumber ?? "")) ?? "",
      showWhatsapp: data.showWhatsapp,
      contactEmail: data.contactEmail ?? "",
      metaTitle: data.metaTitle ?? "",
      metaDescription: data.metaDescription ?? "",
      logo: data.logo ?? "",
      bannerImages: data.bannerImages ?? [],
      aboutText: data.aboutText ?? "",
      theme: data.theme ?? "",
      instagram: data.instagram ?? "",
      facebook: data.facebook ?? "",
      twitter: data.twitter ?? "",
      tiktok: data.tiktok ?? "",
      kwai: data.kwai ?? "",
      youtube: data.youtube ?? "",
      cep: data.cep ?? "",
      address: data.address ?? "",
      district: data.district ?? "",
      number: data.number ?? "",
      id_meta: data.id_meta ?? "",
      pixel_meta: data.pixel_meta ?? "",
      paymentMethodSettings: data.paymentMethodSettings,
      freightOptions: data.freightOptions,
      freightChargeType: data.freightChargeType,
      freightFixedValue: data.freightFixedValue,
      freightValuePerKg: data.freightValuePerKg,
      freeShippingMinValue: data.freeShippingMinValue ?? 0,
      freeShippingEnabled: data.freeShippingEnabled,
      deliveryMethods: data.deliveryMethods,
      deliverySpecialInfo: data.deliverySpecialInfo ?? "",
      cnpj: data.cnpj ?? "",
      walletId: data.walletId ?? "",
    });
  }, [data]);
  const debounceUpdate = useDebouncedValue(settings, 500);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!settings || !data) return <EmptyCatalog />;

  function onSubmit() {
    if (!settings || !debounceUpdate) return;
    useUpdateFieldsCatalogSettings.mutate({
      id: settings.id,
      isActive: debounceUpdate.isActive,
      showPrices: debounceUpdate.showPrices,
      showStock: debounceUpdate.showStock,
      allowOrders: debounceUpdate.allowOrders,
      showProductWithoutStock: debounceUpdate.showProductWithoutStock,
      sortOrder: debounceUpdate.sortOrder,
      operationMode: debounceUpdate.operationMode,
      whatsappNumber: normalizePhone(debounceUpdate.whatsappNumber) || "",
      showWhatsapp: debounceUpdate.showWhatsapp,
      contactEmail: debounceUpdate.contactEmail,
      metaTitle: debounceUpdate.metaTitle,
      metaDescription: debounceUpdate.metaDescription,
      logo: debounceUpdate.logo,
      bannerImages: debounceUpdate.bannerImages,
      aboutText: debounceUpdate.aboutText,
      theme: debounceUpdate.theme,
      instagram: debounceUpdate.instagram,
      facebook: debounceUpdate.facebook,
      twitter: debounceUpdate.twitter,
      tiktok: debounceUpdate.tiktok,
      kwai: debounceUpdate.kwai,
      youtube: debounceUpdate.youtube,
      cep: debounceUpdate.cep,
      address: debounceUpdate.address,
      district: debounceUpdate.district,
      number: debounceUpdate.number,
      id_meta: debounceUpdate.id_meta,
      pixel_meta: debounceUpdate.pixel_meta,
      cnpj: debounceUpdate.cnpj,
      paymentMethodSettings: debounceUpdate.paymentMethodSettings,
      freightOptions: debounceUpdate.freightOptions,
      freightChargeType: debounceUpdate.freightChargeType,
      freightFixedValue: debounceUpdate.freightFixedValue,
      freightValuePerKg: debounceUpdate.freightValuePerKg,
      freeShippingMinValue: debounceUpdate.freeShippingMinValue,
      freeShippingEnabled: debounceUpdate.freeShippingEnabled,
      deliveryMethods: debounceUpdate.deliveryMethods,
      deliverySpecialInfo: debounceUpdate.deliverySpecialInfo,
      walletId: debounceUpdate.walletId,
    });
  }

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl">
        <div className="flex flex-col">
          <Tabs defaultValue="geral">
            <div className="flex justify-between items-center overflow-x-auto">
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}{" "}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button
                className="hidden sm:flex"
                onClick={onSubmit}
                disabled={useUpdateFieldsCatalogSettings.isPending}
              >
                Salvar
                {useUpdateFieldsCatalogSettings.isPending && <Spinner />}
              </Button>
            </div>

            {tabs.map((tab) => {
              const TabComponent = tab.component;
              return (
                <TabsContent key={tab.id} value={tab.id}>
                  <TabComponent settings={settings} setSettings={setSettings} />
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
        <div className="flex items-end justify-end mt-4 sm:hidden">
          <Button onClick={onSubmit}>Salvar</Button>
        </div>
      </main>
    </div>
  );
}
