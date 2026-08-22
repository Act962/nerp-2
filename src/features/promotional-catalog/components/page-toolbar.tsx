"use client";

import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Lock,
  LockOpen,
  Copy,
  Trash2,
  Layers,
  Image as ImageIcon,
  LayoutGrid,
  ArrowDownUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CatalogConfig } from "../types";

const LAYOUT_OPTS: { value: CatalogConfig["layout"]; label: string }[] = [
  { value: "grid-2", label: "2 colunas" },
  { value: "grid-3", label: "3 colunas" },
  { value: "grid-4", label: "4 colunas" },
  { value: "list", label: "Lista" },
  { value: "featured", label: "Destaque" },
  { value: "carousel", label: "Carrossel" },
  { value: "masonry", label: "Masonry" },
  { value: "table", label: "Tabela" },
  { value: "custom", label: "Personalizado" },
];

const SORT_OPTS: { value: CatalogConfig["sortBy"]; label: string }[] = [
  { value: "discount-desc", label: "Maior desconto" },
  { value: "savings-desc", label: "Maior economia" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
  { value: "name-asc", label: "Nome A-Z" },
];

interface PageToolbarProps {
  pageName: string;
  pageIndex: number;
  totalPages: number;
  locked: boolean;
  productCount: number;
  layout: CatalogConfig["layout"];
  gridCols: number;
  gridRows: number;
  sortBy: CatalogConfig["sortBy"];
  onLayoutChange: (v: CatalogConfig["layout"]) => void;
  onGridColsChange: (v: number) => void;
  onGridRowsChange: (v: number) => void;
  onSortChange: (v: CatalogConfig["sortBy"]) => void;
  onRename: (name: string) => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  onAddPage: () => void;
  onToggleLock: () => void;
  onDuplicate: (mode: "full" | "background") => void;
  onDelete: () => void;
}

// Cabeçalho da página (estilo Canva) — fica sobre o cinza do preview, logo acima
// do canvas. Reúne as INFORMAÇÕES/AÇÕES da página: nome, Disposição, Ordenação,
// ordenar/inserir, bloquear, duplicar e excluir + navegação entre páginas.
export function PageToolbar({
  pageName,
  pageIndex,
  totalPages,
  locked,
  productCount,
  layout,
  gridCols,
  gridRows,
  sortBy,
  onLayoutChange,
  onGridColsChange,
  onGridRowsChange,
  onSortChange,
  onRename,
  onMovePrev,
  onMoveNext,
  onAddPage,
  onToggleLock,
  onDuplicate,
  onDelete,
}: PageToolbarProps) {
  const [name, setName] = useState(pageName);
  useEffect(() => setName(pageName), [pageName]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== pageName) onRename(trimmed);
    else setName(pageName);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-0.5 py-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setName(pageName);
            e.currentTarget.blur();
          }
        }}
        className="h-7 w-24 shrink-0 border-transparent bg-transparent text-sm font-medium shadow-none"
        aria-label="Nome da página"
      />
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {pageIndex + 1}/{totalPages}
        <span className="ml-1 opacity-60">· {productCount}</span>
      </span>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      {/* Disposição (layout da página) */}
      <div className="flex shrink-0 items-center gap-1">
        <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={layout}
          onValueChange={(v) => onLayoutChange(v as CatalogConfig["layout"])}
        >
          <SelectTrigger
            className="h-7 w-auto shrink-0 gap-1 px-2 text-xs"
            title="Disposição"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAYOUT_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Colunas × Linhas quando a Disposição é personalizada */}
      {layout === "custom" && (
        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="number"
            min={1}
            max={8}
            value={gridCols}
            onChange={(e) =>
              onGridColsChange(
                Math.min(8, Math.max(1, Number(e.target.value) || 1)),
              )
            }
            className="h-7 w-12 shrink-0 px-1.5 text-xs"
            title="Colunas"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            type="number"
            min={1}
            max={12}
            value={gridRows}
            onChange={(e) =>
              onGridRowsChange(
                Math.min(12, Math.max(1, Number(e.target.value) || 1)),
              )
            }
            className="h-7 w-12 shrink-0 px-1.5 text-xs"
            title="Linhas"
          />
        </div>
      )}

      {/* Ordenação */}
      <div className="flex shrink-0 items-center gap-1">
        <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={sortBy}
          onValueChange={(v) => onSortChange(v as CatalogConfig["sortBy"])}
        >
          <SelectTrigger
            className="h-7 w-auto shrink-0 gap-1 px-2 text-xs"
            title="Ordenação"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      {/* Ordenar / inserir página */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={pageIndex === 0}
            onClick={onMovePrev}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mover página para cima</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={pageIndex >= totalPages - 1}
            onClick={onMoveNext}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mover página para baixo</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onAddPage}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Inserir página após esta</TooltipContent>
      </Tooltip>

      {/* Bloquear */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={locked ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onToggleLock}
          >
            {locked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <LockOpen className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {locked ? "Desbloquear edição" : "Bloquear edição"}
        </TooltipContent>
      </Tooltip>

      {/* Duplicar */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Duplicar página</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onDuplicate("full")}>
            <Layers className="mr-2 h-4 w-4" />
            Duplicar tudo (fundo + elementos)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate("background")}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Só o fundo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Excluir (separado, ação destrutiva → abre confirmação) */}
      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={totalPages <= 1}
            onClick={onDelete}
            aria-label="Excluir página"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {totalPages <= 1
            ? "Não é possível excluir a única página"
            : "Excluir página"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
