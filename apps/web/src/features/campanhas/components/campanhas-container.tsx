"use client";

import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels } from "@/features/crm/hooks/use-funnels";
import { useCampanhas, useCriarCampanha } from "../hooks/use-campanhas";
import { CampanhaDetalhe } from "./campanha-detalhe";

const ROTULO_DE_STATUS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  SENDING: "Disparando",
  SENT: "Enviada",
  PAUSED: "Pausada",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

export function CampanhasContainer() {
  const { data: dadosDeFunis, isPending: carregandoFunis } = useFunnels();
  const [funnelId, setFunnelId] = useQueryState("funil");
  const [campanhaId, setCampanhaId] = useQueryState("campanha");
  const { data, isPending } = useCampanhas(funnelId);
  const criar = useCriarCampanha();
  const [nome, setNome] = useState("");
  const [aberto, setAberto] = useState(false);

  const funis = dadosDeFunis?.funis ?? [];

  useEffect(() => {
    if (!funnelId && funis.length > 0) setFunnelId(funis[0]?.id ?? null);
  }, [funnelId, funis, setFunnelId]);

  if (carregandoFunis) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando…
      </div>
    );
  }

  if (funis.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
        Crie um funil antes: a campanha sai do número ligado a ele, e a
        audiência vem dos clientes dele.
      </p>
    );
  }

  if (campanhaId) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setCampanhaId(null)}
        >
          <ArrowLeft className="size-4" />
          Todas as campanhas
        </Button>
        <CampanhaDetalhe broadcastId={campanhaId} />
      </div>
    );
  }

  const campanhas = data?.campanhas ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          value={funnelId ?? undefined}
          onValueChange={(valor) => setFunnelId(valor)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione o funil" />
          </SelectTrigger>
          <SelectContent>
            {funis.map((funil) => (
              <SelectItem key={funil.id} value={funil.id}>
                {funil.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Nova campanha
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova campanha</DialogTitle>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="nome-campanha">Nome</FieldLabel>
              <Input
                id="nome-campanha"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Promoção de setembro"
              />
            </Field>
            <DialogFooter>
              <Button
                disabled={criar.isPending || nome.trim().length === 0}
                onClick={async () => {
                  if (!funnelId) return;
                  const criada = await criar.mutateAsync({
                    funnelId,
                    name: nome,
                  });
                  setNome("");
                  setAberto(false);
                  setCampanhaId(criada.id);
                }}
              >
                {criar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Carregando campanhas…
        </div>
      ) : campanhas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          Nenhuma campanha ainda. Crie a primeira para disparar um template
          aprovado para os clientes deste funil.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {campanhas.map((campanha) => (
            <li key={campanha.id}>
              <button
                type="button"
                onClick={() => setCampanhaId(campanha.id)}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-sm">
                  {campanha.nome}
                </span>
                <Badge variant="secondary">
                  {ROTULO_DE_STATUS[campanha.status] ?? campanha.status}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {campanha.enviadas}/{campanha.totalDestinatarios} enviadas
                  {campanha.falharam > 0
                    ? ` · ${campanha.falharam} falharam`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
