"use client";

import { Loader2, Plus, Workflow, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFunnels } from "@/features/crm/hooks/use-funnels";
import { useAutomacoes, useCriarAutomacao } from "../hooks/use-automacoes";
import { GATILHOS, rotuloDoNo } from "../lib/catalogo-de-nos";

export function AutomacoesContainer() {
  const { data, isLoading } = useAutomacoes();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando automações…
      </div>
    );
  }

  const automacoes = data?.automacoes ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NovaAutomacao />
      </div>

      {automacoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Workflow className="size-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma automação ainda</p>
            <p className="max-w-md text-muted-foreground text-sm">
              Uma automação começa com um gatilho — mensagem que chega, contato
              novo, card que muda de coluna — e executa os passos que você
              montar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {automacoes.map((automacao) => (
            <Card key={automacao.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/whatsapp/automacoes/${automacao.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {automacao.name}
                    </Link>
                    <p className="truncate text-muted-foreground text-xs">
                      {automacao.funnelName}
                    </p>
                  </div>
                  <Badge variant={automacao.isActive ? "default" : "secondary"}>
                    {automacao.isActive ? "Ligada" : "Desligada"}
                  </Badge>
                </div>

                <p className="text-muted-foreground text-sm">
                  {automacao.gatilho
                    ? rotuloDoNo(automacao.gatilho)
                    : "Sem gatilho"}{" "}
                  · {automacao.passos}{" "}
                  {automacao.passos === 1 ? "passo" : "passos"}
                </p>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Zap className="size-3" />
                    {automacao.execucoes24h === 0
                      ? "sem execuções em 24h"
                      : `${automacao.execucoes24h} em 24h`}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/whatsapp/automacoes/${automacao.id}`}>
                      Abrir
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NovaAutomacao() {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [gatilho, setGatilho] = useState<string>("TRIGGER_MESSAGE_IN");
  const [minutos, setMinutos] = useState("60");

  const { data: funis } = useFunnels();
  const criar = useCriarAutomacao();

  const escolhido = GATILHOS.find((g) => g.tipo === gatilho);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nova automação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova automação</DialogTitle>
          <DialogDescription>
            Ela nasce desligada. Você monta os passos e liga quando estiver
            pronta.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="auto-nome">Nome</FieldLabel>
            <Input
              id="auto-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Responder fora do horário, recuperar parado…"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="auto-funil">Funil</FieldLabel>
            <Select value={funnelId} onValueChange={setFunnelId}>
              <SelectTrigger id="auto-funil">
                <SelectValue placeholder="Onde ela vale" />
              </SelectTrigger>
              <SelectContent>
                {(funis?.funis ?? []).map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    {funil.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="auto-gatilho">Gatilho</FieldLabel>
            <Select value={gatilho} onValueChange={setGatilho}>
              <SelectTrigger id="auto-gatilho">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GATILHOS.map((item) => (
                  <SelectItem key={item.tipo} value={item.tipo}>
                    {item.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {escolhido && (
              <p className="text-muted-foreground text-xs">
                {escolhido.descricao}
              </p>
            )}
          </Field>

          {gatilho === "TRIGGER_LEAD_IDLE" && (
            <Field>
              <FieldLabel htmlFor="auto-minutos">
                Minutos sem resposta
              </FieldLabel>
              <Input
                id="auto-minutos"
                type="number"
                min={1}
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
              />
            </Field>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button
            disabled={!nome.trim() || !funnelId || criar.isPending}
            onClick={() =>
              criar.mutate(
                {
                  funnelId,
                  name: nome.trim(),
                  gatilho: gatilho as (typeof GATILHOS)[number]["tipo"],
                  minutos:
                    gatilho === "TRIGGER_LEAD_IDLE"
                      ? Number(minutos)
                      : undefined,
                },
                {
                  onSuccess: (criada) => {
                    setAberto(false);
                    setNome("");
                    window.location.href = `/whatsapp/automacoes/${criada.id}`;
                  },
                },
              )
            }
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar e montar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
