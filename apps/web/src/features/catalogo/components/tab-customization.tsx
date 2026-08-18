"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CatalogSettingsProps } from "./catalog";
import { colors } from "./mock/catalog-moc";
import { Field, FieldDescription } from "@/components/ui/field";
import { CarouselUploader } from "./file-uploader/carousel-uploader";
import Image from "next/image";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

interface CustomizationTabProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

export function TabCustomization({
  settings,
  setSettings,
}: CustomizationTabProps) {
  const [imageSelected, setImageSelected] = useState<string | undefined>(
    undefined,
  );

  const onChangeImage = (imageNow: string) => {
    setImageSelected(imageNow);
    setSettings({
      ...settings,
      bannerImages: [...settings.bannerImages, imageNow],
    });
  };

  useEffect(() => {
    setImageSelected(undefined);
  }, [settings.bannerImages]);

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Personalização
        </h2>
        <p className="text-sm text-muted-foreground">
          Customize a aparência do seu catálogo
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="carouselImage">Carrossel inicial</Label>

            <Field className="text-center">
              <CarouselUploader
                fileTypeAccepted="image"
                onConfirm={onChangeImage}
                value={imageSelected}
              />
              <FieldDescription>
                Formatos aceitos: JPG, PNG, GIF
                <br />
                Tamanho máximo: 5MB
              </FieldDescription>
            </Field>
            <p className="text-xs text-muted-foreground">
              Aparecerá no topo do catálogo
            </p>
            <div className="flex items-center gap-2">
              {settings.bannerImages &&
                settings.bannerImages.map((image, index) => (
                  <div
                    key={image}
                    className="relative h-13 w-13 border rounded-sm"
                  >
                    <div className="opacity-0 hover:opacity-100 transition-opacity absolute top-0 left-0 w-full h-full bg-black/50 items-center justify-center cursor-pointer z-10">
                      <Trash2Icon
                        className="w-4 h-4 text-white"
                        onClick={() => {
                          setSettings({
                            ...settings,
                            bannerImages: settings.bannerImages.filter(
                              (img) => img !== image,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Image
                        src={useConstructUrl(image)}
                        alt={`Imagem do catalogo - ${index}`}
                        fill
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ColorPicker">Cor do tema do catálogo</Label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <div
                  className={`p-0.5 rounded-full items-center justify-center ${
                    settings.theme === color &&
                    "border-2 border-accent-foreground/70 shadow-lg"
                  }`}
                  key={`id-${color}`}
                >
                  <div
                    style={{ backgroundColor: color }}
                    className={`w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform duration-200 `}
                    onClick={() => setSettings({ ...settings, theme: color })}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
