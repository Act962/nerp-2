"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarOff, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DayOfWeek } from "@/generated/prisma/enums";
import { formatWhatsapp } from "@/lib/whatsapp";
import {
  useAgenda,
  useBloquearData,
  useCancelarCompromisso,
  useCompromissos,
  useEditarAgenda,
  useSalvarGrade,
} from "../hooks/use-agenda";
import { linkPublico } from "../lib/link-publico";
import { CopiarLink } from "./agendas-container";
import { MarcarCompromisso } from "./marcar-compromisso";

const NOME_DO_DIA: Record<DayOfWeek, string> = {
  SUNDAY: "Domingo",
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
};

type Faixa = { startTime: string; endTime: string };
type Dia = { dayOfWeek: DayOfWeek; isActive: boolean; faixas: Faixa[] };

export function AgendaEditor({ agendaId }: { agendaId: string }) {
  const { data: agenda, isLoading } = useAgenda(agendaId);

  if (isLoading || !agenda) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando agenda…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{agenda.name}</p>
            <p className="truncate text-muted-foreground text-xs">
              {linkPublico(agenda.orgSlug, agenda.slug)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CopiarLink orgSlug={agenda.orgSlug} agendaSlug={agenda.slug} />
            <AtivarAgenda agendaId={agenda.id} ativa={agenda.isActive} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="horarios">
        <TabsList>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="compromissos">Compromissos</TabsTrigger>
        </TabsList>

        <TabsContent value="horarios" className="mt-4 flex flex-col gap-4">
          <GradeSemanal agendaId={agenda.id} semana={agenda.semana} />
          <DiasFechados agendaId={agenda.id} bloqueios={agenda.bloqueios} />
        </TabsContent>

        <TabsContent value="compromissos" className="mt-4">
          <Compromissos
            agendaId={agenda.id}
            orgSlug={agenda.orgSlug}
            agendaSlug={agenda.slug}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AtivarAgenda({
  agendaId,
  ativa,
}: {
  agendaId: string;
  ativa: boolean;
}) {
  const editar = useEditarAgenda();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="agenda-ativa"
        checked={ativa}
        onCheckedChange={(valor) =>
          editar.mutate({ agendaId, isActive: valor })
        }
      />
      <label htmlFor="agenda-ativa" className="text-sm">
        {/* Pausada some da internet: o link devolve "não encontrada", que é o
            que o operador espera de uma agenda desligada. */}
        {ativa ? "Recebendo marcações" : "Pausada"}
      </label>
    </div>
  );
}

function GradeSemanal({
  agendaId,
  semana,
}: {
  agendaId: string;
  semana: Dia[];
}) {
  const [rascunho, setRascunho] = useState<Dia[]>(semana);
  const salvar = useSalvarGrade();

  // A grade vem do servidor; depois de salvar, o refetch traz a versão gravada
  // e o rascunho acompanha em vez de continuar mostrando o estado antigo.
  useEffect(() => setRascunho(semana), [semana]);

  const mexer = (dia: string, mudanca: (atual: Dia) => Dia) =>
    setRascunho((atual) =>
      atual.map((item) => (item.dayOfWeek === dia ? mudanca(item) : item)),
    );

  const alterado = JSON.stringify(rascunho) !== JSON.stringify(semana);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Horários da semana</CardTitle>
        <Button
          size="sm"
          disabled={!alterado || salvar.isPending}
          onClick={() => salvar.mutate({ agendaId, semana: rascunho })}
        >
          {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rascunho.map((dia) => (
          <div
            key={dia.dayOfWeek}
            className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start"
          >
            <div className="flex w-36 shrink-0 items-center gap-2 pt-1">
              <Switch
                checked={dia.isActive}
                onCheckedChange={(valor) =>
                  mexer(dia.dayOfWeek, (atual) => ({
                    ...atual,
                    isActive: valor,
                    // Ligar um dia sem faixa nenhuma não ofereceria horário —
                    // começa com o horário comercial e o operador ajusta.
                    faixas:
                      valor && atual.faixas.length === 0
                        ? [{ startTime: "08:00", endTime: "12:00" }]
                        : atual.faixas,
                  }))
                }
              />
              <span className="text-sm">{NOME_DO_DIA[dia.dayOfWeek]}</span>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {!dia.isActive || dia.faixas.length === 0 ? (
                <span className="pt-1 text-muted-foreground text-sm">
                  Sem atendimento
                </span>
              ) : (
                dia.faixas.map((faixa, indice) => (
                  <div key={indice} className="flex items-center gap-2">
                    <Input
                      type="time"
                      className="w-32"
                      value={faixa.startTime}
                      onChange={(e) =>
                        mexer(dia.dayOfWeek, (atual) => ({
                          ...atual,
                          faixas: atual.faixas.map((f, i) =>
                            i === indice
                              ? { ...f, startTime: e.target.value }
                              : f,
                          ),
                        }))
                      }
                    />
                    <span className="text-muted-foreground text-sm">às</span>
                    <Input
                      type="time"
                      className="w-32"
                      value={faixa.endTime}
                      onChange={(e) =>
                        mexer(dia.dayOfWeek, (atual) => ({
                          ...atual,
                          faixas: atual.faixas.map((f, i) =>
                            i === indice
                              ? { ...f, endTime: e.target.value }
                              : f,
                          ),
                        }))
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        mexer(dia.dayOfWeek, (atual) => ({
                          ...atual,
                          faixas: atual.faixas.filter((_, i) => i !== indice),
                        }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))
              )}

              {dia.isActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() =>
                    mexer(dia.dayOfWeek, (atual) => ({
                      ...atual,
                      faixas: [
                        ...atual.faixas,
                        { startTime: "14:00", endTime: "18:00" },
                      ],
                    }))
                  }
                >
                  <Plus className="size-4" />
                  Faixa
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DiasFechados({
  agendaId,
  bloqueios,
}: {
  agendaId: string;
  bloqueios: string[];
}) {
  const [data, setData] = useState("");
  const bloquear = useBloquearData();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dias fechados</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            type="date"
            className="w-44"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!data || bloquear.isPending}
            onClick={() =>
              bloquear.mutate(
                { agendaId, date: data, isBlocked: true },
                { onSuccess: () => setData("") },
              )
            }
          >
            <CalendarOff className="size-4" />
            Fechar dia
          </Button>
        </div>

        {bloqueios.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum feriado ou folga marcado. O dia fechado some do calendário do
            cliente, mesmo estando na grade da semana.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bloqueios.map((dia) => (
              <Badge key={dia} variant="secondary" className="gap-1 py-1">
                {format(new Date(`${dia}T12:00:00`), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
                <button
                  type="button"
                  aria-label={`Reabrir ${dia}`}
                  onClick={() =>
                    bloquear.mutate({
                      agendaId,
                      date: dia,
                      isBlocked: false,
                    })
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PERIODOS = [
  { valor: "7", rotulo: "Próximos 7 dias" },
  { valor: "30", rotulo: "Próximos 30 dias" },
  { valor: "90", rotulo: "Próximos 90 dias" },
];

function Compromissos({
  agendaId,
  orgSlug,
  agendaSlug,
}: {
  agendaId: string;
  orgSlug: string;
  agendaSlug: string;
}) {
  const [dias, setDias] = useState("30");

  const hoje = new Date();
  const fim = new Date(hoje.getTime() + Number(dias) * 86_400_000);
  const { data, isLoading } = useCompromissos({
    agendaId,
    de: hoje.toISOString().slice(0, 10),
    ate: fim.toISOString().slice(0, 10),
  });
  const cancelar = useCancelarCompromisso();

  const compromissos = data?.compromissos ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Compromissos</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((periodo) => (
                <SelectItem key={periodo.valor} value={periodo.valor}>
                  {periodo.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MarcarCompromisso
            agendaId={agendaId}
            orgSlug={orgSlug}
            agendaSlug={agendaSlug}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Carregando…
          </div>
        ) : compromissos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nada marcado nesse período.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {compromissos.map((compromisso) => (
              <div
                key={compromisso.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">
                    {compromisso.leadName ?? compromisso.title ?? "Sem nome"}
                    {compromisso.status === "CANCELLED" && (
                      <Badge variant="secondary" className="ml-2">
                        Cancelado
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-muted-foreground text-xs">
                    {format(
                      new Date(compromisso.startsAt),
                      "EEEE, dd/MM 'às' HH:mm",
                      { locale: ptBR },
                    )}
                    {compromisso.leadPhone
                      ? ` · ${formatWhatsapp(compromisso.leadPhone)}`
                      : ""}
                  </p>
                </div>

                {compromisso.status !== "CANCELLED" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Cancelar compromisso"
                    disabled={cancelar.isPending}
                    onClick={() =>
                      cancelar.mutate({ appointmentId: compromisso.id })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
