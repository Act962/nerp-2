"use client";

import { useState } from "react";
import { BookmarkPlus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDeleteOracleQueryTemplate,
  useOracleQueryTemplates,
  useSaveOracleQueryTemplate,
} from "../hooks/use-oracle-explorer";
import {
  type OracleQueryConfig,
  oracleQueryConfigSchema,
} from "../lib/oracle-query-config";
import { ORACLE_QUERY_TEMPLATES } from "../lib/oracle-query-templates";

type ApplyPayload = {
  config: OracleQueryConfig;
  displayType: "STAT" | "CHART" | "LIST" | "TABLE";
  name: string;
};

/**
 * Padrões de busca: modelos prontos (curados) + os salvos pela organização.
 * Clicar preenche o montador inteiro — é o atalho para não começar do zero.
 */
export function OracleTemplatePicker({
  availableTables,
  currentConfig,
  currentDisplayType,
  onApply,
}: {
  availableTables: string[];
  currentConfig: OracleQueryConfig;
  currentDisplayType: string;
  onApply: (payload: ApplyPayload) => void;
}) {
  const { data } = useOracleQueryTemplates(true);
  const saveTemplate = useSaveOracleQueryTemplate();
  const deleteTemplate = useDeleteOracleQueryTemplate();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const saved = data?.templates ?? [];
  const canSave = Boolean(currentConfig.table) && currentDisplayType !== "MAP";

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-background p-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="size-3" /> Padrões de busca
        </Label>
        {canSave && !saving && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[10px]"
            onClick={() => setSaving(true)}
          >
            <BookmarkPlus className="size-3" /> salvar esta
          </Button>
        )}
      </div>

      {saving && (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            className="h-7 text-xs"
            placeholder="Nome do modelo"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={!name.trim() || saveTemplate.isPending}
            onClick={() => {
              saveTemplate.mutate(
                {
                  name: name.trim(),
                  config: currentConfig,
                  displayType: currentDisplayType as
                    | "STAT"
                    | "CHART"
                    | "LIST"
                    | "TABLE",
                },
                {
                  onSuccess: () => {
                    setName("");
                    setSaving(false);
                  },
                },
              );
            }}
          >
            Salvar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              setName("");
              setSaving(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {ORACLE_QUERY_TEMPLATES.map((template) => {
          // Winthor varia entre clientes — modelo cuja tabela não existe aqui
          // fica desabilitado em vez de dar erro no "Testar consulta".
          const missing =
            availableTables.length > 0 &&
            !availableTables.includes(template.config.table);
          const chip = (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={missing}
              className="h-6 px-2 text-[10px]"
              onClick={() =>
                onApply({
                  config: template.config,
                  displayType: template.displayType,
                  name: template.label,
                })
              }
            >
              {template.label}
            </Button>
          );
          return (
            <Tooltip key={template.key}>
              <TooltipTrigger asChild>
                {missing ? <span>{chip}</span> : chip}
              </TooltipTrigger>
              <TooltipContent>
                {missing
                  ? `Tabela ${template.config.table} não disponível nesta conexão.`
                  : template.description}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {saved.map((template) => {
          const parsed = oracleQueryConfigSchema.safeParse(template.config);
          if (!parsed.success) return null;
          return (
            <span
              key={template.id}
              className="flex items-center rounded-md border border-primary/40 bg-primary/5"
            >
              <button
                type="button"
                className="px-2 py-1 text-[10px]"
                onClick={() =>
                  onApply({
                    config: parsed.data,
                    displayType: template.displayType as
                      | "STAT"
                      | "CHART"
                      | "LIST"
                      | "TABLE",
                    name: template.name,
                  })
                }
              >
                {template.name}
              </button>
              <button
                type="button"
                title="Remover modelo"
                className="pr-1.5 text-muted-foreground hover:text-destructive"
                disabled={deleteTemplate.isPending}
                onClick={() =>
                  deleteTemplate.mutate({ templateId: template.id })
                }
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
