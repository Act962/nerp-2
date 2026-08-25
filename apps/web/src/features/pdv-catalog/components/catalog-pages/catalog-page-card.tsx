"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CatalogRow } from "@/features/pdv-catalog/lib/catalog-types";
import { constructUrl } from "@/hooks/use-construct-url";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PlusIcon, Trash2, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUpdateTradeCatalogPage } from "../../hooks/use-trade-catalog-doc";

export interface CatalogPageItem {
  id: string;
  title: string;
  mediaTypeCode: string | null;
  order: number;
  photoKeys: string[];
  rows: CatalogRow[];
}

interface CatalogPageCardProps {
  page: CatalogPageItem;
  position: number;
  total: number;
  onRemove: () => void;
}

function serializeContent(title: string, rows: CatalogRow[]) {
  return JSON.stringify({ title, rows });
}

function newRow(): CatalogRow {
  return {
    id: crypto.randomUUID(),
    storeId: null,
    storeName: "",
    mediaTypeName: "",
    quantity: 1,
    price: null,
    status: "Disponível",
    note: null,
  };
}

export function CatalogPageCard({
  page,
  position,
  total,
  onRemove,
}: CatalogPageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });
  const updatePage = useUpdateTradeCatalogPage();

  const [title, setTitle] = useState(page.title);
  const [rows, setRows] = useState<CatalogRow[]>(page.rows);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true);
  // Último conteúdo que sabemos estar no servidor — o que veio via props ou o
  // que acabamos de mandar. Serve pra distinguir "o servidor mudou por baixo de
  // nós" (regeneração de páginas) de "o servidor só devolveu o nosso próprio
  // autosave", que não pode descartar o que o usuário digitou desde então.
  const syncedRef = useRef(serializeContent(page.title, page.rows));

  useEffect(() => {
    const incoming = serializeContent(page.title, page.rows);
    if (incoming === syncedRef.current) return;

    // Chegou conteúdo novo do servidor (ex.: "Gerar páginas" reescreveu as
    // linhas). Sem isto o card seguia com o snapshot antigo e o próximo
    // autosave gravava o obsoleto por cima do recém-gerado.
    syncedRef.current = incoming;
    skipNextSaveRef.current = true;
    setTitle(page.title);
    setRows(page.rows);
  }, [page.title, page.rows]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      syncedRef.current = serializeContent(title, rows);
      updatePage.mutate({ id: page.id, title, rows });
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, rows]);

  // `min={0}` no input não impede digitar "-5", e o schema do servidor é
  // `nonnegative()`: sem clamp o autosave passa a falhar a cada tecla e a
  // página inteira fica impossível de salvar até dar reload.
  const toNonNegative = (raw: string) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const updateRow = (rowId: string, patch: Partial<CatalogRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const addRow = () => setRows((current) => [...current, newRow()]);
  const removeRow = (rowId: string) =>
    setRows((current) => current.filter((row) => row.id !== rowId));

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      // bg-card e não bg-white fixo: os campos e a tabela usam as cores do
      // tema, então com fundo branco forçado o texto ficava branco no branco
      // no modo escuro. Este card é superfície de edição, não uma réplica
      // da página do PDF — pode seguir o tema.
      className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex items-center justify-between bg-[#c1121f] px-5 py-3">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Título da página"
          className="h-auto max-w-md border-none bg-transparent p-0 text-lg font-bold uppercase tracking-tight text-white placeholder:text-white/60 focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="flex size-7 cursor-grab items-center justify-center rounded-md bg-white/15 text-white active:cursor-grabbing"
            title="Arraste para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25"
            title="Remover página"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {page.photoKeys.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {page.photoKeys.map((key) => (
              // biome-ignore lint/performance/noImgElement: preview simples de key do R2, sem otimização do next/image
              <img
                key={key}
                src={constructUrl(key)}
                alt=""
                // contain preserva o enquadramento original da foto; cover
                // cortava as laterais do espaço fotografado.
                className="h-28 w-40 rounded-md border bg-muted object-contain"
              />
            ))}
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead className="text-center">Qtd.</TableHead>
                <TableHead>Preço/mês</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-16 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma linha ainda.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      value={row.storeName}
                      onChange={(event) =>
                        updateRow(row.id, { storeName: event.target.value })
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.id, {
                          quantity: Math.trunc(
                            toNonNegative(event.target.value),
                          ),
                        })
                      }
                      className="h-8 w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.price ?? ""}
                      onChange={(event) =>
                        updateRow(row.id, {
                          price:
                            event.target.value === ""
                              ? null
                              : toNonNegative(event.target.value),
                        })
                      }
                      className="h-8 w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.status}
                      onChange={(event) =>
                        updateRow(row.id, { status: event.target.value })
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.note ?? ""}
                      onChange={(event) =>
                        updateRow(row.id, { note: event.target.value || null })
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.id)}
                      title="Remover linha"
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={addRow}
        >
          <PlusIcon className="size-4" />
          Adicionar linha
        </Button>
      </div>

      <div className="flex items-center justify-end border-t px-5 py-2 text-xs text-neutral-500">
        {position} / {total}
      </div>
    </div>
  );
}
