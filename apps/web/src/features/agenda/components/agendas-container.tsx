"use client";

import { CalendarClock, Link2, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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
import { useAgendas, useCriarAgenda } from "../hooks/use-agenda";
import { linkPublico } from "../lib/link-publico";

export function AgendasContainer() {
  const { data, isLoading } = useAgendas();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando agendas…
      </div>
    );
  }

  const agendas = data?.agendas ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NovaAgenda />
      </div>

      {agendas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarClock className="size-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma agenda ainda</p>
            <p className="max-w-md text-muted-foreground text-sm">
              Uma agenda gera um link que o cliente abre, escolhe o horário e
              marca sozinho. Quem marca entra no funil como lead.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agendas.map((agenda) => (
            <Card key={agenda.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/whatsapp/agenda/${agenda.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {agenda.name}
                    </Link>
                    <p className="truncate text-muted-foreground text-xs">
                      {agenda.funnelName} · {agenda.slotDuration} min
                    </p>
                  </div>
                  <Badge variant={agenda.isActive ? "default" : "secondary"}>
                    {agenda.isActive ? "Ativa" : "Pausada"}
                  </Badge>
                </div>

                <p className="text-muted-foreground text-sm">
                  {agenda.proximos === 0
                    ? "Sem horários marcados"
                    : `${agenda.proximos} ${agenda.proximos === 1 ? "horário marcado" : "horários marcados"}`}
                </p>

                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/whatsapp/agenda/${agenda.id}`}>Abrir</Link>
                  </Button>
                  <CopiarLink
                    orgSlug={data?.orgSlug ?? ""}
                    agendaSlug={agenda.slug}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function CopiarLink({
  orgSlug,
  agendaSlug,
}: {
  orgSlug: string;
  agendaSlug: string;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        const url = linkPublico(orgSlug, agendaSlug);
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copiado");
        } catch {
          // Navegador sem permissão de área de transferência (http em rede
          // local, por exemplo): mostra o link para copiar na mão em vez de
          // falhar em silêncio.
          toast.info(url, { duration: 10_000 });
        }
      }}
    >
      <Link2 className="size-4" />
      Link
    </Button>
  );
}

function NovaAgenda() {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [duracao, setDuracao] = useState("30");

  const { data: funis } = useFunnels();
  const criar = useCriarAgenda();

  const disponiveis = funis?.funis ?? [];

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nova agenda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova agenda</DialogTitle>
          <DialogDescription>
            Ela já nasce atendendo de segunda a sexta, 8h–12h e 14h–18h. Os
            horários são ajustados depois.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="agenda-nome">Nome</FieldLabel>
            <Input
              id="agenda-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Consultoria, Visita técnica…"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="agenda-funil">Funil</FieldLabel>
            <Select value={funnelId} onValueChange={setFunnelId}>
              <SelectTrigger id="agenda-funil">
                <SelectValue placeholder="Onde o lead entra" />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    {funil.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="agenda-duracao">
              Duração de cada horário
            </FieldLabel>
            <Select value={duracao} onValueChange={setDuracao}>
              <SelectTrigger id="agenda-duracao">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["15", "20", "30", "45", "60", "90", "120"].map((min) => (
                  <SelectItem key={min} value={min}>
                    {min} minutos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            disabled={!nome.trim() || !funnelId || criar.isPending}
            onClick={() =>
              criar.mutate(
                {
                  name: nome.trim(),
                  funnelId,
                  slotDuration: Number(duracao),
                },
                {
                  onSuccess: () => {
                    setAberto(false);
                    setNome("");
                  },
                },
              )
            }
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar agenda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
