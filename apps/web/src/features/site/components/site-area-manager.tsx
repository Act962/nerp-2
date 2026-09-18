"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  useDeleteSiteArea,
  useReorderSiteAreas,
  useSaveSiteArea,
  useSiteAreas,
  useToggleSiteArea,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";
import { SiteImagePicker } from "./site-image-picker";

type Draft = {
  id?: string;
  name: string;
  slug: string;
  color: string;
  iconImage: string;
  visible: boolean;
};

const emptyDraft: Draft = {
  name: "",
  slug: "",
  color: "",
  iconImage: "",
  visible: true,
};

export function SiteAreaManager() {
  const [draft, setDraft] = useState<Draft | null>(null);

  const { items, isLoading } = useSiteAreas();
  const save = useSaveSiteArea();
  const toggle = useToggleSiteArea();
  const reorder = useReorderSiteAreas();
  const remove = useDeleteSiteArea();

  function move(index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ ids: next.map((i) => i.id) });
  }

  return (
    <>
      <SitePageHeader
        title="Áreas"
        description="As áreas da empresa que filtram o painel de Soluções. A ordem aqui é a ordem dos botões; a escondida some."
        actions={
          <Button onClick={() => setDraft({ ...emptyDraft })}>Nova área</Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Áreas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comercial, Financeiro, RH… O visitante clica numa e vê só as
              soluções ligadas a ela.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-0 pb-2">
            {isLoading && <Skeleton className="mx-4 h-24" />}
            {!isLoading && items.length === 0 && (
              <p className="px-6 pb-4 text-sm text-muted-foreground">
                Nenhuma área ainda. Enquanto esta lista estiver vazia, o site
                usa as áreas que já vêm no código.
              </p>
            )}
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex flex-col">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Subir"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Descer"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>

                {item.color && (
                  <span
                    className="size-4 shrink-0 rounded-full border"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                )}

                <button
                  type="button"
                  className="min-w-40 flex-1 text-left"
                  onClick={() =>
                    setDraft({
                      id: item.id,
                      name: item.name,
                      slug: item.slug,
                      color: item.color ?? "",
                      iconImage: item.iconImage ?? "",
                      visible: item.visible,
                    })
                  }
                >
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.slug}
                  </span>
                </button>

                <Switch
                  checked={item.visible}
                  onCheckedChange={(visible) =>
                    toggle.mutate({ id: item.id, visible })
                  }
                  aria-label={`Mostrar ${item.name} no site`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {draft && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {draft.id ? "Área" : "Nova área"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                O botão do filtro de Soluções.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="area-name">Nome</FieldLabel>
                <Input
                  id="area-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Comercial"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="area-slug">Identificador</FieldLabel>
                <Input
                  id="area-slug"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="comercial"
                />
                <FieldDescription>
                  Vai na URL (/solucoes?area=comercial) e casa a área com as
                  soluções. Só minúsculas, números e hífen.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="area-color">Cor do botão</FieldLabel>
                <Input
                  id="area-color"
                  value={draft.color}
                  onChange={(e) =>
                    setDraft({ ...draft, color: e.target.value })
                  }
                  placeholder="#1e9dfb"
                />
              </Field>

              <SiteImagePicker
                label="Ícone (opcional)"
                value={draft.iconImage}
                onChange={(iconImage) => setDraft({ ...draft, iconImage })}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate(
                      {
                        id: draft.id,
                        name: draft.name,
                        slug: draft.slug,
                        color: draft.color || null,
                        iconImage: draft.iconImage || null,
                        iconKey: null,
                        visible: draft.visible,
                      },
                      { onSuccess: () => setDraft(null) },
                    )
                  }
                >
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                {draft.id && (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      const id = draft.id;
                      if (!id) return;
                      remove.mutate(
                        { id },
                        { onSuccess: () => setDraft(null) },
                      );
                    }}
                  >
                    <Trash2 className="size-4" />
                    Excluir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
