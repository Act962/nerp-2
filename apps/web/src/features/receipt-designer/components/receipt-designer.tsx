"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Printer, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useReceiptTemplates,
  useUpdateReceiptTemplate,
} from "../hooks/use-receipt-templates";
import { SAMPLE_DATA } from "../lib/presets";
import type {
  ReceiptBlock,
  ReceiptPaper,
  ReceiptTemplate,
  ReceiptType,
} from "../lib/types";
import { BlockEditor } from "./block-editor";
import { makeBlock } from "./block-fields";
import { ReceiptPrintArea, triggerReceiptPrint } from "./receipt-print";
import { ReceiptRender } from "./receipt-render";
import {
  RECEIPT_PAPER_LABELS,
  RECEIPT_TYPE_LABELS,
  TemplateList,
} from "./template-list";

const PAPER_OPTIONS: ReceiptPaper[] = ["MM80", "MM58", "A4"];
const TYPE_OPTIONS: ReceiptType[] = ["NAO_FISCAL", "FISCAL", "ORCAMENTO"];

export function ReceiptDesigner() {
  const { data, isLoading } = useReceiptTemplates();
  const templates = useMemo(() => data?.templates ?? [], [data]);
  const update = useUpdateReceiptTemplate();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Estado local da edição — recarregado sempre que o template selecionado muda.
  const [name, setName] = useState("");
  const [type, setType] = useState<ReceiptType>("NAO_FISCAL");
  const [paper, setPaper] = useState<ReceiptPaper>("MM80");
  const [blocks, setBlocks] = useState<ReceiptBlock[]>([]);

  // Seleciona o primeiro template quando a lista carrega e nada está selecionado.
  useEffect(() => {
    if (!selectedId && templates.length > 0) {
      setSelectedId(templates[0].id);
    }
    if (selectedId && !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0]?.id ?? null);
    }
  }, [templates, selectedId]);

  const selected: ReceiptTemplate | null = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  // Recarrega o estado local a partir do template selecionado.
  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setType(selected.type);
    setPaper(selected.paper);
    setBlocks(selected.blocks);
  }, [selected]);

  const changeBlock = (id: string, patch: Partial<ReceiptBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...patch } as ReceiptBlock) : b)),
    );
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const addBlock = (kind: ReceiptBlock["kind"]) => {
    setBlocks((prev) => [...prev, makeBlock(kind)]);
  };

  const handleSave = () => {
    if (!selected) return;
    update.mutate({ id: selected.id, name, type, paper, blocks });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
      {/* Esquerda: lista de templates */}
      <Card className="p-4 lg:h-[calc(100vh-13rem)]">
        <TemplateList
          templates={templates}
          selectedId={selectedId}
          onSelect={setSelectedId}
          isLoading={isLoading}
        />
      </Card>

      {/* Centro: editor do template */}
      <div className="flex flex-col gap-4">
        {!selected ? (
          <Card className="p-4">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nenhum template selecionado</EmptyTitle>
                <EmptyDescription>
                  Selecione um template à esquerda ou crie um novo para começar
                  a editar.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <>
            <Card className="gap-4 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="grid flex-1 grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Papel
                    </Label>
                    <Select
                      value={paper}
                      onValueChange={(v) => setPaper(v as ReceiptPaper)}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAPER_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {RECEIPT_PAPER_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Tipo
                    </Label>
                    <Select
                      value={type}
                      onValueChange={(v) => setType(v as ReceiptType)}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {RECEIPT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSave} disabled={update.isPending}>
                  <Save className="size-4" />
                  Salvar
                </Button>
              </div>
            </Card>

            <BlockEditor
              blocks={blocks}
              onChangeBlock={changeBlock}
              onMove={moveBlock}
              onRemove={removeBlock}
              onAdd={addBlock}
            />
          </>
        )}
      </div>

      {/* Direita: preview ao vivo */}
      <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Pré-visualização</h2>
          {selected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerReceiptPrint(paper)}
            >
              <Printer className="size-4" />
              Imprimir teste
            </Button>
          )}
        </div>
        <div className="flex justify-center rounded-lg bg-muted p-4">
          {selected ? (
            <ReceiptRender
              blocks={blocks}
              data={SAMPLE_DATA}
              paper={paper}
              className="shadow-lg"
            />
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              Selecione um template.
            </p>
          )}
        </div>
      </div>

      {selected && (
        <ReceiptPrintArea blocks={blocks} data={SAMPLE_DATA} paper={paper} />
      )}
    </div>
  );
}
