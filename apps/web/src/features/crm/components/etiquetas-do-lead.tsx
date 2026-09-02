"use client";

import { Check, Plus, Tag as TagIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useCriarEtiqueta,
  useEtiquetas,
  useEtiquetarLead,
} from "../hooks/use-etiquetas";

/**
 * As etiquetas do contato, editáveis no próprio painel.
 *
 * Grava a lista inteira a cada clique, sem botão de salvar: marcar etiqueta é
 * gesto rápido no meio do atendimento, e um "salvar" esquecido é a etiqueta
 * que ninguém vê depois.
 */
export function EtiquetasDoLead({
  leadId,
  funnelId,
  atuais,
}: {
  leadId: string;
  funnelId: string;
  atuais: { id: string; nome: string; cor: string | null }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const { data } = useEtiquetas(funnelId, aberto);
  const etiquetar = useEtiquetarLead();
  const criar = useCriarEtiqueta();

  const disponiveis = data?.etiquetas ?? [];
  const marcadas = new Set(atuais.map((tag) => tag.id));

  const filtradas = disponiveis.filter((etiqueta) =>
    etiqueta.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const nomeLivre =
    busca.trim().length > 0 &&
    !disponiveis.some(
      (etiqueta) => etiqueta.nome.toLowerCase() === busca.trim().toLowerCase(),
    );

  function alternar(tagId: string) {
    const proximas = marcadas.has(tagId)
      ? atuais.filter((tag) => tag.id !== tagId).map((tag) => tag.id)
      : [...atuais.map((tag) => tag.id), tagId];
    etiquetar.mutate({ leadId, tagIds: proximas });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {atuais.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          style={
            tag.cor
              ? { backgroundColor: `${tag.cor}22`, color: tag.cor }
              : undefined
          }
        >
          {tag.nome}
        </Badge>
      ))}

      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs">
            <Plus className="size-3" />
            Etiqueta
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <Input
            autoFocus
            placeholder="Buscar ou criar…"
            className="mb-2 h-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <div className="flex max-h-56 flex-col overflow-y-auto">
            {filtradas.map((etiqueta) => (
              <button
                key={etiqueta.id}
                type="button"
                className="flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => alternar(etiqueta.id)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: etiqueta.cor ?? "#94a3b8" }}
                  />
                  <span className="truncate">{etiqueta.nome}</span>
                </span>
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    marcadas.has(etiqueta.id) ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            ))}

            {filtradas.length === 0 && !nomeLivre && (
              <p className="px-2 py-3 text-center text-muted-foreground text-xs">
                Nenhuma etiqueta ainda.
              </p>
            )}
          </div>

          {nomeLivre && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full justify-start gap-2"
              disabled={criar.isPending}
              onClick={() =>
                criar.mutate(
                  { nome: busca.trim() },
                  {
                    onSuccess: (nova) => {
                      setBusca("");
                      etiquetar.mutate({
                        leadId,
                        tagIds: [...atuais.map((tag) => tag.id), nova.id],
                      });
                    },
                  },
                )
              }
            >
              <TagIcon className="size-3" />
              Criar "{busca.trim()}"
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
