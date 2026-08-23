"use client";

import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type CatalogConfig,
  type TemplateKind,
  applyTemplateSlice,
  toTemplateConfig,
} from "../types";
import {
  useCatalogTemplates,
  useCreateCatalogTemplate,
  useDeleteCatalogTemplate,
} from "../hooks/use-catalog";

const CATS: { kind: TemplateKind; label: string }[] = [
  { kind: "background", label: "Padrão de Fundo" },
  { kind: "group", label: "Padrão de grupo de produtos" },
  { kind: "label", label: "Padrão de etiquetas" },
];

// "Padrões do Sistema": 3 categorias de padrões UNIVERSAIS (fundo / grupo /
// etiquetas + dinâmicos). As miniaturas servem de INSPIRAÇÃO; aplicar copia só a
// aparência daquela categoria — nunca produtos/preços/lista.
export function SystemTemplatesPanel({
  config,
  onConfigChange,
  captureThumbnail,
}: {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  captureThumbnail?: () => Promise<string>;
}) {
  const [cat, setCat] = useState<TemplateKind>("background");
  const [name, setName] = useState("");
  const { data } = useCatalogTemplates();
  const create = useCreateCatalogTemplate();
  const del = useDeleteCatalogTemplate();
  const canManage = data?.canManageSystem ?? false;

  const items = (data?.system ?? []).filter(
    (t) =>
      (t.config as { templateKind?: TemplateKind } | null)?.templateKind ===
      cat,
  );
  const catLabel = CATS.find((c) => c.kind === cat)?.label ?? "";

  const save = async () => {
    const title = name.trim();
    if (!title) return;
    const thumbnail = captureThumbnail ? await captureThumbnail() : "";
    create.mutate(
      {
        name: title,
        config: toTemplateConfig(config, cat),
        thumbnail: thumbnail || undefined,
        scope: "SYSTEM",
      },
      { onSuccess: () => setName("") },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Sub-abas das 3 categorias */}
      <div className="flex flex-wrap gap-1">
        {CATS.map((c) => (
          <Button
            key={c.kind}
            type="button"
            size="sm"
            variant={cat === c.kind ? "default" : "outline"}
            className="h-7 px-2 text-[11px]"
            onClick={() => setCat(c.kind)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {/* Salvar a categoria atual como padrão do sistema (só super usuário) */}
      {canManage && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Salvar "{catLabel}" no sistema
          </p>
          <Input
            placeholder="Nome do padrão"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="h-8"
          />
          <Button
            type="button"
            size="sm"
            className="w-full gap-1"
            disabled={!name.trim() || create.isPending}
            onClick={save}
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar padrão do sistema
          </Button>
        </div>
      )}

      {/* Biblioteca de padrões do sistema (inspiração + aplicar) */}
      {items.length === 0 ? (
        <p className="rounded-md bg-muted/50 px-2 py-4 text-center text-xs text-muted-foreground">
          Nenhum padrão de sistema em "{catLabel}" ainda.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-1 rounded-lg border p-1.5"
            >
              <div
                className={cn(
                  "aspect-square w-full overflow-hidden rounded-md bg-muted",
                )}
              >
                {t.thumbnail ? (
                  // biome-ignore lint/performance/noImgElement: miniatura data-URL
                  <img
                    src={t.thumbnail}
                    alt={t.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <span className="truncate text-[11px] font-medium">{t.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 text-[11px]"
                  onClick={() =>
                    onConfigChange(
                      applyTemplateSlice(t.config as Record<string, unknown>),
                    )
                  }
                >
                  Aplicar
                </Button>
                {canManage && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive"
                    title="Excluir padrão do sistema"
                    onClick={() => del.mutate({ id: t.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        As imagens são só inspiração — aplicar copia apenas a aparência (fundo /
        grupo / etiqueta + dinâmicos), nunca produtos ou preços.
      </p>
    </div>
  );
}
