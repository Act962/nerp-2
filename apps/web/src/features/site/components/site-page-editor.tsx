"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  BLOCK_HINTS,
  BLOCK_LABELS,
  emptyBlock,
  type SiteBlock,
  type SiteBlockType,
} from "@nerp/site-content";
import { useSavePage, useSitePage } from "../hooks/use-site-admin";
import { sitePath, siteUrl } from "../lib/section";
import { SitePageHeader } from "./site-page-header";
import { SiteBlockFields } from "./site-block-fields";
import { SiteImagePicker } from "./site-image-picker";

const ALL_TYPES = Object.keys(BLOCK_LABELS) as SiteBlockType[];

export function SitePageEditor({ pageId }: { pageId: string }) {
  const { page, isLoading } = useSitePage(pageId);
  const save = useSavePage();

  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<SiteBlock[]>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [selected, setSelected] = useState(0);

  // O estado local nasce do servidor UMA VEZ por página, e o `ref` é o que
  // garante isso: sem ele, um refetch em segundo plano (voltar para a aba,
  // reconectar) jogaria fora o que a pessoa está digitando. Trocar de página
  // reabre a porta.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!page || loadedFor.current === pageId) return;
    loadedFor.current = pageId;
    setTitle(page.title);
    setBlocks(page.blocks);
    setSeoTitle(page.seoTitle);
    setSeoDescription(page.seoDescription);
    setOgImage(page.ogImage);
    setSelected(0);
  }, [page, pageId]);

  if (isLoading || !page) {
    return <Skeleton className="h-96 w-full" />;
  }

  const current = blocks[selected];

  function persist(publish: boolean) {
    save.mutate({
      id: pageId,
      title,
      blocks,
      seoTitle,
      seoDescription,
      ogImage,
      publish,
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
    setSelected(target);
  }

  return (
    <>
      <SitePageHeader
        title={page.title}
        description={`Página em ${sitePath(page.section, page.slug)}. Os blocos são os mesmos em qualquer página — ligue, desligue e mova.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a
                href={siteUrl(page.section, page.slug)}
                target="_blank"
                rel="noreferrer"
              >
                Pré-visualizar
              </a>
            </Button>
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => persist(false)}
            >
              Salvar rascunho
            </Button>
            <Button disabled={save.isPending} onClick={() => persist(true)}>
              Salvar e publicar
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Blocos da página</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Na ordem em que aparecem.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="size-4" />
                    Adicionar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {ALL_TYPES.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onSelect={() => {
                        const block = emptyBlock(
                          type,
                          `${type}-${Date.now().toString(36)}`,
                        );
                        setBlocks([...blocks, block]);
                        setSelected(blocks.length);
                      }}
                    >
                      {BLOCK_LABELS[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {blocks.length === 0 && (
                <p className="px-6 pb-4 text-sm text-muted-foreground">
                  Página vazia. Adicione o primeiro bloco.
                </p>
              )}
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0",
                    index === selected && "bg-muted/60",
                  )}
                >
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label="Subir"
                      disabled={index === 0}
                      onClick={() => moveBlock(index, -1)}
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label="Descer"
                      disabled={index === blocks.length - 1}
                      onClick={() => moveBlock(index, 1)}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </div>

                  <button
                    type="button"
                    className="min-w-32 flex-1 text-left"
                    onClick={() => setSelected(index)}
                  >
                    <span className="block text-sm font-medium">
                      {BLOCK_LABELS[block.type]}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {BLOCK_HINTS[block.type]}
                    </span>
                  </button>

                  {!block.enabled && <Badge variant="outline">oculto</Badge>}

                  <Switch
                    checked={block.enabled}
                    aria-label={`Mostrar o bloco ${BLOCK_LABELS[block.type]}`}
                    onCheckedChange={(enabled) => {
                      const next = [...blocks];
                      next[index] = { ...block, enabled };
                      setBlocks(next);
                    }}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir bloco"
                    onClick={() => {
                      setBlocks(blocks.filter((_, i) => i !== index));
                      setSelected(0);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Busca</CardTitle>
              <p className="text-sm text-muted-foreground">
                Título e descrição que aparecem no Google e no WhatsApp.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="page-title">Título da página</FieldLabel>
                <Input
                  id="page-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="seo-title">Título na busca</FieldLabel>
                <Input
                  id="seo-title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={`${page.title} — ÓRBITA HUB`}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="seo-desc">Descrição</FieldLabel>
                <Textarea
                  id="seo-desc"
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                />
                <FieldDescription>
                  Vazia, o site usa o texto do herói.
                </FieldDescription>
              </Field>
              <SiteImagePicker
                label="Imagem do compartilhamento"
                value={ogImage}
                onChange={setOgImage}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">
              {current ? BLOCK_LABELS[current.type] : "Nenhum bloco"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {current
                ? BLOCK_HINTS[current.type]
                : "Adicione um bloco à esquerda."}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {current && (
              <SiteBlockFields
                block={current}
                onChange={(block) => {
                  const next = [...blocks];
                  next[selected] = block;
                  setBlocks(next);
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
