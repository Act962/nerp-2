"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDEX_FONT_SIZE } from "../lib/catalog-index";
import type {
  CatalogConfig,
  CatalogIndexMode,
  CatalogIndexStyle,
} from "../types";
import { TEXT_FONTS } from "../types";
import { ColorPickerField } from "./color-picker-field";

// Propriedades da PÁGINA DE ÍNDICE. Só aparece quando a página é um índice.
//
// Aqui mora só o que é do índice em si. O resto já é da página e vive nas abas
// de sempre — o que evita duplicar controle:
//   • fundo (cor, degradê, imagem) → aba "Fundo"
//   • título "ÍNDICE" por cima     → aba "Texto" (texto livre, por página)
//   • mover/redimensionar o bloco  → arrastando no próprio canvas
//
// Mover e redimensionar funcionam porque o índice OCUPA o `productGroup` da
// página: a mesma moldura com alças que o grupo de produtos usa.

const MODOS: { value: CatalogIndexMode; label: string }[] = [
  { value: "product", label: "Por produto" },
  { value: "page", label: "Por página/cliente" },
  { value: "category", label: "Por categoria" },
];

interface IndexPropertiesProps {
  config: CatalogConfig;
  onConfigChange: (patch: Partial<CatalogConfig>) => void;
}

export function IndexProperties({
  config,
  onConfigChange,
}: IndexPropertiesProps) {
  if (config.kind !== "index") return null;

  const estilo = config.indexStyle ?? {};
  const patch = (p: Partial<CatalogIndexStyle>) =>
    onConfigChange({ indexStyle: { ...estilo, ...p } });

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <p className="font-medium text-[13px] text-foreground">Índice</p>

      <div className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground">Listar</Label>
        <Select
          value={config.indexMode ?? "product"}
          onValueChange={(v) =>
            onConfigChange({ indexMode: v as CatalogIndexMode })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODOS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground">Tipografia</Label>
        <Select
          value={estilo.fontFamily ?? TEXT_FONTS[0].value}
          onValueChange={(v) => patch({ fontFamily: v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_FONTS.map((f) => (
              <SelectItem key={f.value} value={f.value} className="text-xs">
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            Tamanho da letra
          </Label>
          {/* Diminuir a letra faz caber MAIS linhas por página: a capacidade
              do índice é recalculada a partir daqui. */}
          <Input
            type="number"
            min={8}
            max={40}
            className="h-8 text-xs"
            value={estilo.fontSize ?? INDEX_FONT_SIZE}
            onChange={(e) =>
              patch({ fontSize: Math.max(8, Number(e.target.value) || 8) })
            }
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">Colunas</Label>
          <Input
            type="number"
            min={1}
            max={4}
            className="h-8 text-xs"
            value={estilo.columns ?? 2}
            onChange={(e) =>
              patch({
                columns: Math.min(4, Math.max(1, Number(e.target.value) || 1)),
              })
            }
          />
        </div>
      </div>

      <ColorPickerField
        label="Cor do texto"
        value={estilo.color ?? "#111111"}
        onChange={(hex) => patch({ color: hex })}
      />

      <p className="text-[11px] text-muted-foreground">
        Para mover ou redimensionar, arraste o índice no canvas. O fundo fica na
        aba <b>Fundo</b>, e um título “ÍNDICE” por cima sai da aba <b>Texto</b>.
      </p>
    </div>
  );
}
