"use client";

import { useState } from "react";
import { Loader2, Lock, Save, Shapes, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { SectionCard, Segmented, SectionTitle } from "./panel-ui";

const CATS: { kind: TemplateKind; label: string }[] = [
  { kind: "background", label: "Fundos" },
  { kind: "label", label: "Etiquetas" },
  { kind: "group", label: "Grupos" },
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
      <SectionTitle icon={Shapes}>Padrões do sistema</SectionTitle>

      {/* Menu das 3 categorias */}
      <Segmented
        value={cat}
        onChange={setCat}
        options={CATS.map((c) => ({ value: c.kind, label: c.label }))}
      />

      {/* Salvar a categoria atual como padrão do sistema — só o super usuário. */}
      {canManage ? (
        <SectionCard className="gap-2.5">
          <SectionTitle icon={Save}>
            Salvar "{catLabel}" no sistema
          </SectionTitle>
          <Input
            placeholder="Nome do padrão"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="h-10 rounded-xl lg:h-9"
          />
          <Button
            type="button"
            className="h-10 w-full gap-2 rounded-xl text-[14px] lg:h-9 lg:text-[13px]"
            disabled={!name.trim() || create.isPending}
            onClick={save}
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar padrão do sistema
          </Button>
        </SectionCard>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Só o administrador do sistema adiciona padrões. Você pode aplicar os
          existentes.
        </div>
      )}

      {/* Biblioteca de padrões do sistema (inspiração + aplicar) */}
      {items.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-3 py-5 text-center text-[13px] text-muted-foreground">
          Nenhum padrão de sistema em "{catLabel}" ainda.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-1.5 rounded-2xl border bg-card/40 p-2"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
                {t.thumbnail ? (
                  // biome-ignore lint/performance/noImgElement: miniatura data-URL
                  <img
                    src={t.thumbnail}
                    alt={t.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <span className="truncate px-0.5 text-[12px] font-medium">
                {t.name}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 rounded-lg text-[12px]"
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
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    title="Excluir padrão do sistema"
                    onClick={() => del.mutate({ id: t.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[12px] leading-snug text-muted-foreground">
        As imagens são só inspiração — aplicar copia apenas a aparência (fundo /
        etiqueta / grupo + dinâmicos), nunca produtos ou preços.
      </p>
    </div>
  );
}
