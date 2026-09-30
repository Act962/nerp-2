"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { data, isLoading, isError } = useCatalogSettingsPrivate();
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
      backgroundColor: data.backgroundColor ?? "",
      headerColor: data.headerColor ?? "",
      brandColors: data.brandColors,
      astroEnabled: data.astroEnabled,
      categoryDisplay: data.categoryDisplay,
      showOffersButton: data.showOffersButton,
      categoryCardColor: data.categoryCardColor ?? "",
      categoryIconColor: data.categoryIconColor ?? "",
      categoryTextColor: data.categoryTextColor ?? "",
      hideProductsWithoutImage: data.hideProductsWithoutImage,
      offerCatalogIds: data.offerCatalogIds,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!settings || !data) return <EmptyCatalog erro={isError} />;

  function onSubmit() {
    if (!settings) return;
    useUpdateFieldsCatalogSettings.mutate({
      id: settings.id,
      isActive: settings.isActive,
      showPrices: settings.showPrices,
      showStock: settings.showStock,
      allowOrders: settings.allowOrders,
      showProductWithoutStock: settings.showProductWithoutStock,
      sortOrder: settings.sortOrder,
      operationMode: settings.operationMode,
      whatsappNumber: normalizePhone(settings.whatsappNumber) || "",
      showWhatsapp: settings.showWhatsapp,
      contactEmail: settings.contactEmail,
      metaTitle: settings.metaTitle,
      metaDescription: settings.metaDescription,
      logo: settings.logo,
      bannerImages: settings.bannerImages,
      aboutText: settings.aboutText,
      theme: settings.theme,
      backgroundColor: settings.backgroundColor,
      headerColor: settings.headerColor,
      brandColors: settings.brandColors,
      astroEnabled: settings.astroEnabled,
      categoryDisplay: settings.categoryDisplay,
      showOffersButton: settings.showOffersButton,
      categoryCardColor: settings.categoryCardColor,
      categoryIconColor: settings.categoryIconColor,
      categoryTextColor: settings.categoryTextColor,
      hideProductsWithoutImage: settings.hideProductsWithoutImage,
      offerCatalogIds: settings.offerCatalogIds,
      instagram: settings.instagram,
      facebook: settings.facebook,
      twitter: settings.twitter,
      tiktok: settings.tiktok,
      kwai: settings.kwai,
      youtube: settings.youtube,
      cep: settings.cep,
      address: settings.address,
      district: settings.district,
      number: settings.number,
      id_meta: settings.id_meta,
      pixel_meta: settings.pixel_meta,
      cnpj: settings.cnpj,
      paymentMethodSettings: settings.paymentMethodSettings,
      freightOptions: settings.freightOptions,
      freightChargeType: settings.freightChargeType,
      freightFixedValue: settings.freightFixedValue,
      freightValuePerKg: settings.freightValuePerKg,
      freeShippingMinValue: settings.freeShippingMinValue,
      freeShippingEnabled: settings.freeShippingEnabled,
      deliveryMethods: settings.deliveryMethods,
      deliverySpecialInfo: settings.deliverySpecialInfo,
      walletId: settings.walletId,
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
                  <TabsTrigger
                    key={tab.id}
                    data-jornada={
                      tab.id === "geral"
                        ? "catalogo-abas"
                        : tab.id === "visibility"
                          ? "catalogo-aba-visibilidade"
                          : undefined
                    }
                    value={tab.id}
                  >
                    {tab.label}{" "}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button
                data-jornada="catalogo-salvar"
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
