"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  useDeleteMenuItem,
  useReorderMenu,
  useSaveMenuItem,
  useSiteMenu,
  useToggleMenuItem,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";
import { SiteImagePicker } from "./site-image-picker";

type Panel = "SOLUCOES" | "SEGMENTOS" | "SOBRE";

const PANELS: { id: Panel; label: string; hint: string }[] = [
  {
    id: "SOLUCOES",
    label: "Soluções",
    hint: "As ferramentas da suíte. A coluna é a categoria.",
  },
  {
    id: "SEGMENTOS",
    label: "Segmentos",
    hint: "Os setores atendidos, em cards com a cor de cada um.",
  },
  {
    id: "SOBRE",
    label: "Sobre nós",
    hint: "Institucional, parcerias e treinamentos.",
  },
];

type Draft = {
  id?: string;
  groupTitle: string;
  slug: string;
  name: string;
  summary: string;
  color: string;
  href: string;
  iconImage: string;
  visible: boolean;
};

const emptyDraft: Draft = {
  groupTitle: "",
  slug: "",
  name: "",
  summary: "",
  color: "",
  href: "",
  iconImage: "",
  visible: true,
};

export function SiteMenuManager() {
  const [panel, setPanel] = useState<Panel>("SOLUCOES");
  const [draft, setDraft] = useState<Draft | null>(null);

  const { items, isLoading } = useSiteMenu(panel);
  const save = useSaveMenuItem();
  const toggle = useToggleMenuItem();
  const reorder = useReorderMenu();
  const remove = useDeleteMenuItem();

  const active = PANELS.find((p) => p.id === panel);

  function move(index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ panel, ids: next.map((i) => i.id) });
  }

  return (
    <>
      <SitePageHeader
        title="Menu"
        description="Os três painéis da barra. A ordem aqui é a ordem no site; o desligado some."
        actions={
          <Button onClick={() => setDraft({ ...emptyDraft })}>Novo item</Button>
        }
      />

      <Tabs
        value={panel}
        onValueChange={(value) => {
          setPanel(value as Panel);
          setDraft(null);
        }}
        className="mb-4"
      >
        <TabsList>
          {PANELS.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{active?.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{active?.hint}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-0 pb-2">
            {isLoading && <Skeleton className="mx-4 h-24" />}
            {!isLoading && items.length === 0 && (
              <p className="px-6 pb-4 text-sm text-muted-foreground">
                Nenhum item ainda. Enquanto esta lista estiver vazia, o site usa
                o catálogo que já vem no código.
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

                <button
                  type="button"
                  className="min-w-40 flex-1 text-left"
                  onClick={() =>
                    setDraft({
                      id: item.id,
                      groupTitle: item.groupTitle,
                      slug: item.slug,
                      name: item.name,
                      summary: item.summary,
                      color: item.color ?? "",
                      href: item.href ?? "",
                      iconImage: item.iconImage ?? "",
                      visible: item.visible,
                    })
                  }
                >
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.href || "sem página — leva à órbita"}
                  </span>
                </button>

                <Badge variant="secondary">{item.groupTitle}</Badge>

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
                {draft.id ? "Item do menu" : "Novo item"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                É o que abre quando alguém clica no nome.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="menu-name">Nome</FieldLabel>
                  <Input
                    id="menu-name"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="menu-group">Coluna</FieldLabel>
                  <Input
                    id="menu-group"
                    value={draft.groupTitle}
                    onChange={(e) =>
                      setDraft({ ...draft, groupTitle: e.target.value })
                    }
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="menu-summary">Descrição curta</FieldLabel>
                <Textarea
                  id="menu-summary"
                  rows={2}
                  value={draft.summary}
                  onChange={(e) =>
                    setDraft({ ...draft, summary: e.target.value })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="menu-slug">Identificador</FieldLabel>
                <Input
                  id="menu-slug"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="crm-tracking"
                />
                <FieldDescription>
                  É o que casa este item com o ícone e a estação na órbita. Só
                  minúsculas, números e hífen.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="menu-href">Para onde vai</FieldLabel>
                <Input
                  id="menu-href"
                  value={draft.href}
                  onChange={(e) => setDraft({ ...draft, href: e.target.value })}
                  placeholder="/solucoes/crm-tracking"
                />
                <FieldDescription>
                  Vazio mantém o comportamento de hoje: a ferramenta leva à sua
                  estação na órbita, segmento e “sobre” levam ao WhatsApp.
                  Endereço com http abre em aba nova.
                </FieldDescription>
              </Field>

              {panel === "SEGMENTOS" && (
                <Field>
                  <FieldLabel htmlFor="menu-color">Cor do card</FieldLabel>
                  <Input
                    id="menu-color"
                    value={draft.color}
                    onChange={(e) =>
                      setDraft({ ...draft, color: e.target.value })
                    }
                    placeholder="#2f9bf5"
                  />
                </Field>
              )}

              <SiteImagePicker
                label="Ícone (opcional)"
                value={draft.iconImage}
                onChange={(iconImage) => setDraft({ ...draft, iconImage })}
              />
              <p className="-mt-2 text-xs text-muted-foreground">
                Sem imagem, o site usa o ícone desenhado para este
                identificador.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate(
                      {
                        id: draft.id,
                        panel,
                        groupTitle: draft.groupTitle,
                        slug: draft.slug,
                        name: draft.name,
                        summary: draft.summary,
                        color: draft.color || null,
                        href: draft.href || null,
                        iconKey: null,
                        iconImage: draft.iconImage || null,
                        pageId: null,
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
