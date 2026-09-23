"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { CatalogSettingsProps } from "./catalog";
import { colors } from "./mock/catalog-moc";
import { ColorPicker } from "./color-picker";
import { Switch } from "@/components/ui/switch";
import {
  FUNDO_PADRAO_CATALOGO,
  TEMA_PADRAO_CATALOGO,
  fundoEscuro,
  isHexValido,
  tintaSobre,
} from "@/features/storefront/lib/cores";
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

          <div className="grid gap-6 sm:grid-cols-2">
            <ColorPicker
              label="Cor do tema"
              description="Botões, destaques e detalhes da vitrine."
              value={settings.theme || null}
              defaultValue={TEMA_PADRAO_CATALOGO}
              presets={colors}
              onChange={(hex) => setSettings({ ...settings, theme: hex })}
              onReset={() => setSettings({ ...settings, theme: "" })}
            />

            <ColorPicker
              label="Cor de fundo da página"
              description="O fundo de todas as páginas do catálogo."
              value={settings.backgroundColor || null}
              defaultValue={FUNDO_PADRAO_CATALOGO}
              presets={FUNDOS_SUGERIDOS}
              onChange={(hex) =>
                setSettings({ ...settings, backgroundColor: hex })
              }
              onReset={() => setSettings({ ...settings, backgroundColor: "" })}
            />
          </div>

          <Previa
            tema={
              isHexValido(settings.theme)
                ? settings.theme
                : TEMA_PADRAO_CATALOGO
            }
            fundo={
              isHexValido(settings.backgroundColor)
                ? settings.backgroundColor
                : FUNDO_PADRAO_CATALOGO
            }
          />

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="astroEnabled">Astro atendendo na vitrine</Label>
              <p className="text-xs text-muted-foreground">
                Um assistente que conhece a sua loja responde dúvidas de quem
                está navegando: produtos, preços, formas de pagamento e entrega.
                Cada conversa consome ★ da organização.
              </p>
            </div>
            <Switch
              id="astroEnabled"
              checked={settings.astroEnabled}
              onCheckedChange={(marcado) =>
                setSettings({ ...settings, astroEnabled: marcado })
              }
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Fundos que funcionam com quase qualquer tema — claros, e um escuro. */
const FUNDOS_SUGERIDOS = [
  "#ffffff",
  "#f5f5f5",
  "#f1f5f9",
  "#faf5ff",
  "#fff7ed",
  "#f0fdf4",
  "#1f2937",
  "#111111",
];

/**
 * A prévia.
 *
 * Fundo e tema só se julgam JUNTOS: escolhidos em dois campos separados, dá
 * para acertar os dois e ainda assim publicar um preto sobre azul-marinho.
 */
function Previa({ tema, fundo }: { tema: string; fundo: string }) {
  const tinta = tintaSobre(fundo);

  return (
    <div className="space-y-2">
      <Label>Prévia</Label>
      <div
        className="flex items-center gap-4 rounded-lg border p-4"
        style={{ backgroundColor: fundo, color: tinta }}
      >
        <div
          className="size-14 shrink-0 rounded-sm border border-black/10"
          style={{
            backgroundColor: tinta === "#111111" ? "#ffffff" : "#000000",
            opacity: 0.06,
          }}
        />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">Produto de exemplo</p>
          <p className="text-lg font-bold">R$ 19,90</p>
        </div>
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ backgroundColor: tema, color: tintaSobre(tema) }}
        >
          Adicionar
        </button>
      </div>
      {fundoEscuro(fundo) && (
        <p className="text-xs text-muted-foreground">
          Fundo escuro: os textos da vitrine passam a ser claros.
        </p>
      )}
    </div>
  );
}
