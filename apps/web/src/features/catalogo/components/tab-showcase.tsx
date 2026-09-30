"use client";

import { ImageIcon, ImagePlusIcon, Trash2Icon, TypeIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { CatalogCategoryDisplay } from "@/generated/prisma/enums";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import {
  ICONES_DE_CATEGORIA,
  iconeDaCategoria,
} from "@/features/storefront/lib/icones-de-categoria";
import {
  useAtualizarCategoriaDaVitrine,
  useCatalogosDeOferta,
  useCategoriasDaVitrine,
} from "../hooks/use-vitrine";
import { enviarImagem } from "../lib/enviar-imagem";
import {
  TEMA_PADRAO_CATALOGO,
  coresDoCartao,
  isHexValido,
} from "@/features/storefront/lib/cores";
import { ColorPicker } from "./color-picker";
import type { TabProps } from "./mock/catalog-moc";

const MODOS: {
  valor: CatalogCategoryDisplay;
  rotulo: string;
  Icone: typeof ImageIcon;
}[] = [
  { valor: "ICON", rotulo: "Ícone", Icone: iconeDaCategoria("frutas") },
  { valor: "IMAGE", rotulo: "Imagem", Icone: ImageIcon },
  { valor: "TEXT", rotulo: "Somente texto", Icone: TypeIcon },
];

export function TabShowcase({ settings, setSettings }: TabProps) {
  const { data: categorias, isPending } = useCategoriasDaVitrine();
  const { data: catalogos } = useCatalogosDeOferta();
  const modo = settings.categoryDisplay;

  const alternarOferta = (id: string, marcado: boolean) =>
    setSettings({
      ...settings,
      offerCatalogIds: marcado
        ? [...settings.offerCatalogIds, id]
        : settings.offerCatalogIds.filter((atual) => atual !== id),
    });

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div>
        <h2 className="font-semibold text-foreground text-xl">Vitrine</h2>
        <p className="text-muted-foreground text-sm">
          Como as categorias e as ofertas aparecem para o cliente
        </p>
      </div>

      <Card className="gap-5 p-6">
        <div className="flex flex-col gap-1">
          <Label>Categorias na vitrine</Label>
          <p className="text-muted-foreground text-xs">
            Aparecem as categorias principais que têm produtos. A escolha de
            ícone ou imagem de cada uma é salva na hora.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          {MODOS.map(({ valor, rotulo, Icone }) => (
            <button
              key={valor}
              type="button"
              onClick={() =>
                setSettings({ ...settings, categoryDisplay: valor })
              }
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                modo === valor
                  ? "border-primary bg-primary/10 font-medium"
                  : "hover:bg-accent",
              )}
            >
              <Icone className="size-5" />
              {rotulo}
            </button>
          ))}
        </div>

        {isPending && <Spinner />}
        {categorias?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nenhuma categoria cadastrada ainda.
          </p>
        )}

        {modo !== "TEXT" && categorias && categorias.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {categorias.map((categoria) => (
              <LinhaDaCategoria
                key={categoria.id}
                categoria={categoria}
                modo={modo}
              />
            ))}
          </ul>
        )}
      </Card>

      <AparenciaDosCartoes
        settings={settings}
        setSettings={setSettings}
        categorias={categorias ?? []}
      />

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sem-foto">Esconder produtos sem foto</Label>
            <p className="text-muted-foreground text-xs">
              Produto sem imagem (ou com imagem que não abre) sai da vitrine.
              Ele continua cadastrado e volta a aparecer quando ganhar uma foto.
            </p>
          </div>
          <Switch
            id="sem-foto"
            checked={settings.hideProductsWithoutImage}
            onCheckedChange={(ligado) =>
              setSettings({ ...settings, hideProductsWithoutImage: ligado })
            }
          />
        </div>
      </Card>

      <Card className="gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="mostrar-ofertas">Botão de ofertas</Label>
            <p className="text-muted-foreground text-xs">
              Um botão "Ofertas" na vitrine que abre os catálogos promocionais
              escolhidos abaixo.
            </p>
          </div>
          <Switch
            id="mostrar-ofertas"
            checked={settings.showOffersButton}
            onCheckedChange={(ligado) =>
              setSettings({ ...settings, showOffersButton: ligado })
            }
          />
        </div>

        {settings.showOffersButton && (
          <div className="flex flex-col gap-2">
            {catalogos?.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Nenhum catálogo promocional criado.{" "}
                <Link href="/catalogo-promocional" className="underline">
                  Criar um agora
                </Link>
              </p>
            )}
            {catalogos?.map((catalogo) => (
              <label
                key={catalogo.id}
                htmlFor={`oferta-${catalogo.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-sm",
                  !catalogo.compartilhado && "opacity-60",
                )}
              >
                <Checkbox
                  id={`oferta-${catalogo.id}`}
                  disabled={!catalogo.compartilhado}
                  checked={settings.offerCatalogIds.includes(catalogo.id)}
                  onCheckedChange={(marcado) =>
                    alternarOferta(catalogo.id, marcado === true)
                  }
                />
                <span className="flex-1">{catalogo.name}</span>
                {!catalogo.compartilhado && (
                  <span className="text-muted-foreground text-xs">
                    Ative o link público no catálogo para escolher
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

type Categoria = {
  id: string;
  name: string;
  image: string | null;
  icon: string | null;
  isActive: boolean;
};

function LinhaDaCategoria({
  categoria,
  modo,
}: {
  categoria: Categoria;
  modo: CatalogCategoryDisplay;
}) {
  const atualizar = useAtualizarCategoriaDaVitrine();
  const [enviando, setEnviando] = useState(false);
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const urlDaImagem = useConstructUrl(categoria.image ?? "");
  const Icone = iconeDaCategoria(categoria.icon);

  const escolherImagem = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const chave = await enviarImagem(arquivo);
      atualizar.mutate({ id: categoria.id, image: chave });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha no envio.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-lg border p-2.5">
      <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {modo === "IMAGE" && categoria.image ? (
          <Image
            src={urlDaImagem}
            alt={categoria.name}
            fill
            className="object-cover"
          />
        ) : modo === "IMAGE" ? (
          <ImageIcon className="size-5 text-muted-foreground" />
        ) : (
          <Icone className="size-5" />
        )}
      </div>

      <span className="min-w-0 flex-1 truncate text-sm">
        {categoria.name}
        {!categoria.isActive && (
          <span className="ml-1 text-muted-foreground text-xs">(inativa)</span>
        )}
      </span>

      {modo === "ICON" && (
        <Popover open={galeriaAberta} onOpenChange={setGaleriaAberta}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              Trocar ícone
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            <div className="grid grid-cols-8 gap-1">
              {Object.entries(ICONES_DE_CATEGORIA).map(
                ([chave, { rotulo, Icone: Opcao }]) => (
                  <button
                    key={chave}
                    type="button"
                    title={rotulo}
                    aria-label={rotulo}
                    onClick={() => {
                      atualizar.mutate({ id: categoria.id, icon: chave });
                      setGaleriaAberta(false);
                    }}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md hover:bg-accent",
                      categoria.icon === chave && "bg-primary/15 text-primary",
                    )}
                  >
                    <Opcao className="size-4" />
                  </button>
                ),
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {modo === "IMAGE" && (
        <div className="flex items-center gap-1">
          <input
            ref={entrada}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(evento) => escolherImagem(evento.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={enviando || atualizar.isPending}
            onClick={() => entrada.current?.click()}
          >
            {enviando ? <Spinner /> : <ImagePlusIcon className="size-4" />}
            {categoria.image ? "Trocar" : "Enviar"}
          </Button>
          {categoria.image && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Remover imagem"
              disabled={atualizar.isPending}
              onClick={() =>
                atualizar.mutate({ id: categoria.id, image: null })
              }
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** Amostras do cartão: as cores da marca primeiro, depois neutros seguros. */
const NEUTROS_DO_CARTAO = [
  "#ffffff",
  "#f5f5f5",
  "#fafaf9",
  "#f1f5f9",
  "#111111",
  "#1f2937",
];

function AparenciaDosCartoes({
  settings,
  setSettings,
  categorias,
}: TabProps & { categorias: Categoria[] }) {
  const tema = isHexValido(settings.theme)
    ? settings.theme
    : TEMA_PADRAO_CATALOGO;
  const cores = coresDoCartao(
    {
      fundo: settings.categoryCardColor,
      icone: settings.categoryIconColor,
      texto: settings.categoryTextColor,
    },
    tema,
  );
  const amostras = [...settings.brandColors, tema, ...NEUTROS_DO_CARTAO].filter(
    (cor, i, lista) => lista.indexOf(cor) === i,
  );
  const exemplo =
    categorias.length > 0
      ? categorias.slice(0, 4)
      : [
          {
            id: "a",
            name: "Bebidas",
            icon: "bebidas",
            image: null,
            isActive: true,
          },
          {
            id: "b",
            name: "Mercearia",
            icon: "mercearia",
            image: null,
            isActive: true,
          },
          {
            id: "c",
            name: "Limpeza",
            icon: "limpeza",
            image: null,
            isActive: true,
          },
        ];

  return (
    <Card className="gap-5 p-6">
      <div className="flex flex-col gap-1">
        <Label>Aparência dos cartões de categoria</Label>
        <p className="text-muted-foreground text-xs">
          Em branco, cada cor se equilibra sozinha: cartão branco, ícone na cor
          do tema e letra legível sobre o cartão.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ColorPicker
          label="Fundo do cartão"
          value={settings.categoryCardColor || null}
          defaultValue="#ffffff"
          presets={amostras}
          onChange={(hex) =>
            setSettings({ ...settings, categoryCardColor: hex })
          }
          onReset={() => setSettings({ ...settings, categoryCardColor: "" })}
        />
        <ColorPicker
          label="Cor do ícone"
          value={settings.categoryIconColor || null}
          defaultValue={cores.icone}
          presets={amostras}
          onChange={(hex) =>
            setSettings({ ...settings, categoryIconColor: hex })
          }
          onReset={() => setSettings({ ...settings, categoryIconColor: "" })}
        />
        <ColorPicker
          label="Cor da letra"
          value={settings.categoryTextColor || null}
          defaultValue={cores.texto}
          presets={amostras}
          onChange={(hex) =>
            setSettings({ ...settings, categoryTextColor: hex })
          }
          onReset={() => setSettings({ ...settings, categoryTextColor: "" })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Prévia</Label>
        <div
          className="flex gap-3 overflow-x-auto rounded-lg border p-4"
          style={{
            backgroundColor: isHexValido(settings.backgroundColor)
              ? settings.backgroundColor
              : "#f5f5f5",
          }}
        >
          {exemplo.map((categoria) => {
            const Icone = iconeDaCategoria(categoria.icon);
            return (
              <div
                key={categoria.id}
                className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-black/5 p-3 text-center shadow-xs"
                style={{ backgroundColor: cores.fundo, color: cores.texto }}
              >
                {settings.categoryDisplay !== "TEXT" && (
                  <Icone
                    className="size-8"
                    strokeWidth={1.5}
                    style={{ color: cores.icone }}
                  />
                )}
                <span
                  className={cn(
                    "line-clamp-2 text-xs",
                    settings.categoryDisplay === "TEXT" && "font-semibold",
                  )}
                >
                  {categoria.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
