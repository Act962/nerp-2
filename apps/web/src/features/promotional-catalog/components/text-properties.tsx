"use client";

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  CaseUpper,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Plus,
  Trash2,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type CatalogConfig,
  ENTITY_TEXT_VARS,
  type EntitySource,
  type EntityTextVar,
  entityVarLabel,
  type LayerSelection,
  makeDynamicTextElement,
  makeTextElement,
  type TextElement,
  TEXT_FONTS,
} from "../types";

interface TextPropertiesProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  selection?: LayerSelection;
  onSelectionChange?: (selection: LayerSelection) => void;
}

// Aba "Texto" (estilo Canva): adicionar texto ao canvas + editar o texto
// selecionado (tipografia, tamanho, cor, negrito/itálico/sublinhado/tachado,
// maiúscula, alinhamento, transparência). Nós de redimensionamento no canvas.
export function TextProperties({
  config,
  onConfigChange,
  selection,
  onSelectionChange,
}: TextPropertiesProps) {
  const texts = config.texts ?? [];
  const selected =
    selection?.kind === "text"
      ? (texts.find((t) => t.id === selection.id) ?? null)
      : null;

  const addText = () => {
    const el = makeTextElement();
    onConfigChange({ texts: [...texts, el] });
    onSelectionChange?.({ kind: "text", id: el.id });
  };

  // Variáveis de texto dinâmico disponíveis: as da entidade da página + org
  // (sempre disponível quando a página é dinâmica).
  const dynType = config.dynamic?.type;
  const dynTextVars: { value: EntityTextVar; label: string }[] = dynType
    ? [
        ...ENTITY_TEXT_VARS[dynType],
        ...(dynType === "org" ? [] : ENTITY_TEXT_VARS.org),
      ]
    : [];

  const addDynamicText = (variable: EntityTextVar) => {
    const source = variable.split(".")[0] as EntitySource;
    const el = makeDynamicTextElement({ source, variable });
    onConfigChange({ texts: [...texts, el] });
    onSelectionChange?.({ kind: "text", id: el.id });
  };

  const update = (patch: Partial<TextElement>) => {
    if (!selected) return;
    onConfigChange({
      texts: texts.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)),
    });
  };

  const remove = () => {
    if (!selected) return;
    onConfigChange({ texts: texts.filter((t) => t.id !== selected.id) });
    onSelectionChange?.(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Button size="sm" className="w-full gap-1" onClick={addText}>
        <Plus className="h-4 w-4" />
        Adicionar texto
      </Button>

      {/* Textos dinâmicos — resolvem um dado da entidade da página dinâmica. */}
      <div className="flex flex-col gap-1.5 rounded-md border p-2">
        <p className="text-[13px] font-medium text-foreground">
          Texto dinâmico
        </p>
        {dynType ? (
          <Select
            value=""
            onValueChange={(v) => addDynamicText(v as EntityTextVar)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Adicionar texto dinâmico…" />
            </SelectTrigger>
            <SelectContent>
              {dynTextVars.map((v) => (
                <SelectItem key={v.value} value={v.value} className="text-xs">
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Ative a “Página dinâmica” na aba Layout para inserir textos que
            resolvem os dados da loja/org/produto/usuário.
          </p>
        )}
      </div>

      {!selected ? (
        <p className="text-xs text-muted-foreground">
          Clique em &quot;Adicionar texto&quot; e depois no texto no catálogo
          para editá-lo. Arraste para mover; use os cantos para redimensionar.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-foreground">
              Texto selecionado
            </p>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              title="Excluir texto"
              onClick={remove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Vínculo dinâmico do texto (quando houver). */}
          {selected.binding && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
              <span className="truncate text-[11px] text-muted-foreground">
                Vinculado a: <b>{entityVarLabel(selected.binding)}</b>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 shrink-0 text-[11px]"
                onClick={() => update({ binding: undefined })}
              >
                Desvincular
              </Button>
            </div>
          )}

          {/* Conteúdo (quando dinâmico, serve de placeholder/fallback). */}
          <Textarea
            value={selected.text}
            onChange={(e) => update({ text: e.target.value })}
            rows={2}
            className="text-sm"
            placeholder="Digite o texto…"
          />

          {/* Tipografia */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tipografia</Label>
            <Select
              value={selected.fontFamily}
              onValueChange={(v) => update({ fontFamily: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_FONTS.map((f) => (
                  <SelectItem
                    key={f.value}
                    value={f.value}
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tamanho + cor */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Tamanho</Label>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  update({ fontSize: Math.max(8, selected.fontSize - 4) })
                }
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-xs tabular-nums">
                {selected.fontSize}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  update({ fontSize: Math.min(400, selected.fontSize + 4) })
                }
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Cor
              <input
                type="color"
                value={selected.color}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-9 cursor-pointer rounded-xl border p-0 shadow-sm"
              />
            </label>
          </div>

          {/* Estilo: B / I / U / S / maiúscula */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Estilo</Label>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { key: "bold", Icon: Bold, title: "Negrito" },
                  { key: "italic", Icon: Italic, title: "Itálico" },
                  { key: "underline", Icon: Underline, title: "Sublinhado" },
                  {
                    key: "strikethrough",
                    Icon: Strikethrough,
                    title: "Tachado",
                  },
                  { key: "uppercase", Icon: CaseUpper, title: "Maiúscula" },
                  { key: "list", Icon: List, title: "Lista" },
                ] as const
              ).map(({ key, Icon, title }) => (
                <Button
                  key={key}
                  type="button"
                  size="icon"
                  variant={selected[key] ? "secondary" : "outline"}
                  className={cn("h-8 w-8", selected[key] && "border-primary")}
                  title={title}
                  onClick={() => update({ [key]: !selected[key] })}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>

          {/* Alinhamento */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Alinhamento</Label>
            <div className="flex gap-1">
              {(
                [
                  { v: "left", Icon: AlignLeft },
                  { v: "center", Icon: AlignCenter },
                  { v: "right", Icon: AlignRight },
                ] as const
              ).map(({ v, Icon }) => (
                <Button
                  key={v}
                  type="button"
                  size="icon"
                  variant={
                    (selected.align ?? "left") === v ? "secondary" : "outline"
                  }
                  className={cn(
                    "h-8 w-8",
                    (selected.align ?? "left") === v && "border-primary",
                  )}
                  onClick={() => update({ align: v })}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>

          {/* Espaçamento entre letras / linhas */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Espaçamento</Label>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Letras</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    update({
                      letterSpacing: Math.max(
                        -10,
                        (selected.letterSpacing ?? 0) - 1,
                      ),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-10 text-center text-[11px] tabular-nums">
                  {selected.letterSpacing ?? 0}px
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    update({
                      letterSpacing: Math.min(
                        40,
                        (selected.letterSpacing ?? 0) + 1,
                      ),
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Linhas</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    update({
                      lineHeight: Math.max(
                        0.8,
                        Math.round(((selected.lineHeight ?? 1.15) - 0.1) * 10) /
                          10,
                      ),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-10 text-center text-[11px] tabular-nums">
                  {(selected.lineHeight ?? 1.15).toFixed(1)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    update({
                      lineHeight: Math.min(
                        3,
                        Math.round(((selected.lineHeight ?? 1.15) + 0.1) * 10) /
                          10,
                      ),
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Ancorar caixa (vertical) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Ancorar caixa</Label>
            <div className="flex gap-1">
              {(
                [
                  { v: "top", Icon: AlignVerticalJustifyStart },
                  { v: "middle", Icon: AlignVerticalJustifyCenter },
                  { v: "bottom", Icon: AlignVerticalJustifyEnd },
                ] as const
              ).map(({ v, Icon }) => (
                <Button
                  key={v}
                  type="button"
                  size="icon"
                  variant={
                    (selected.anchor ?? "middle") === v
                      ? "secondary"
                      : "outline"
                  }
                  className={cn(
                    "h-8 w-8",
                    (selected.anchor ?? "middle") === v && "border-primary",
                  )}
                  onClick={() => update({ anchor: v })}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>

          {/* Dimensão da caixa (px do canvas) — controle de dimensionamento */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Dimensão (px)</Label>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1 text-[11px] text-muted-foreground">
                L
                <Input
                  type="number"
                  min={20}
                  max={1080}
                  value={Math.round(selected.w)}
                  onChange={(e) =>
                    update({
                      w: Math.max(
                        20,
                        Math.min(1080, Number(e.target.value) || 0),
                      ),
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex flex-1 items-center gap-1 text-[11px] text-muted-foreground">
                A
                <Input
                  type="number"
                  min={20}
                  max={2000}
                  value={Math.round(selected.h)}
                  onChange={(e) =>
                    update({
                      h: Math.max(
                        20,
                        Math.min(2000, Number(e.target.value) || 0),
                      ),
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Caixa (borda/fundo) — igual ao "Texto" do Montar card */}
          <div className="flex flex-col gap-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Caixa (borda/fundo)</Label>
              <Button
                type="button"
                size="sm"
                variant={selected.boxed ? "default" : "outline"}
                className="h-6 text-[11px]"
                onClick={() =>
                  update({
                    boxed: !selected.boxed,
                    ...(selected.boxed
                      ? {}
                      : {
                          boxFill: selected.boxFill ?? "#ffffff",
                          boxBorderColor: selected.boxBorderColor ?? "#111111",
                          boxBorderWidth: selected.boxBorderWidth ?? 2,
                          boxRadius: selected.boxRadius ?? 8,
                        }),
                  })
                }
              >
                {selected.boxed ? "Ligada" : "Desligada"}
              </Button>
            </div>
            {selected.boxed && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    Fundo
                    <input
                      type="color"
                      value={selected.boxFill ?? "#ffffff"}
                      onChange={(e) => update({ boxFill: e.target.value })}
                      className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    Borda
                    <input
                      type="color"
                      value={selected.boxBorderColor ?? "#111111"}
                      onChange={(e) =>
                        update({ boxBorderColor: e.target.value })
                      }
                      className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Contorno
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={selected.boxBorderWidth ?? 0}
                    onChange={(e) =>
                      update({ boxBorderWidth: Number(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="w-6 text-right tabular-nums">
                    {selected.boxBorderWidth ?? 0}
                  </span>
                </label>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Cantos
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={selected.boxRadius ?? 0}
                    onChange={(e) =>
                      update({ boxRadius: Number(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="w-6 text-right tabular-nums">
                    {selected.boxRadius ?? 0}
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Transparência */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Transparência</Label>
              <span className="text-xs text-muted-foreground">
                {selected.opacity ?? 100}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[selected.opacity ?? 100]}
              onValueChange={([v]) => update({ opacity: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
