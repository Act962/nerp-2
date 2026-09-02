"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CalendarX, Clock, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { pt } from "react-day-picker/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { maskWhatsapp } from "@/lib/whatsapp";

type Etapa =
  | { nome: "escolhendo" }
  | { nome: "confirmado"; appointmentId: string; startsAt: string };

/** Data como "YYYY-MM-DD" na leitura do calendário, sem passar por UTC. */
function comoDia(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function AgendaPublica({
  orgSlug,
  agendaSlug,
}: {
  orgSlug: string;
  agendaSlug: string;
}) {
  const [dia, setDia] = useState<Date | undefined>();
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [etapa, setEtapa] = useState<Etapa>({ nome: "escolhendo" });
  const [logoQuebrada, setLogoQuebrada] = useState(false);

  const { data: agenda, isLoading } = useQuery(
    orpc.agenda.publica.get.queryOptions({ input: { orgSlug, agendaSlug } }),
  );

  const { data: horarios, isFetching: buscandoHorarios } = useQuery(
    orpc.agenda.publica.slots.queryOptions({
      input: { orgSlug, agendaSlug, date: dia ? comoDia(dia) : "" },
      enabled: Boolean(dia),
    }),
  );

  const marcar = useMutation(
    orpc.agenda.publica.book.mutationOptions({
      onSuccess: (resultado) =>
        setEtapa({
          nome: "confirmado",
          appointmentId: resultado.appointmentId,
          startsAt: resultado.startsAt,
        }),
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agenda) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
        <CalendarX className="size-8 text-muted-foreground" />
        <p className="font-medium">Agenda não encontrada</p>
        <p className="text-muted-foreground text-sm">
          O link pode ter mudado ou a agenda não está mais recebendo marcações.
        </p>
      </div>
    );
  }

  if (etapa.nome === "confirmado") {
    return (
      <Confirmacao
        appointmentId={etapa.appointmentId}
        startsAt={etapa.startsAt}
        agendaName={agenda.name}
        organizationName={agenda.organizationName}
        onDesmarcado={() => {
          setEtapa({ nome: "escolhendo" });
          setHora("");
        }}
      />
    );
  }

  const livres = horarios?.horarios ?? [];
  const podeMarcar = Boolean(dia && hora && nome.trim().length > 1 && telefone);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center gap-3">
        {/* `Organization.logo` guarda a CHAVE no bucket, não a URL — passar o
            valor cru para o `img` rende ícone quebrado no topo da página que o
            cliente abre. */}
        {agenda.organizationLogo && !logoQuebrada ? (
          <Image
            src={constructUrl(agenda.organizationLogo)}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="size-12 rounded-lg object-contain"
            onError={() => setLogoQuebrada(true)}
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">
            {agenda.organizationName}
          </p>
          <h1 className="truncate font-semibold text-xl">{agenda.name}</h1>
        </div>
      </header>

      {agenda.description && (
        <p className="text-muted-foreground text-sm">{agenda.description}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex justify-center p-2 sm:p-4">
            <Calendar
              mode="single"
              locale={pt}
              selected={dia}
              onSelect={(escolhido) => {
                setDia(escolhido);
                setHora("");
              }}
              // O passado não se agenda, e mostrar dia clicável que sempre
              // volta vazio faz o cliente achar que a agenda está quebrada.
              disabled={{ before: new Date() }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Clock className="size-4" />
              {dia
                ? format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })
                : "Escolha um dia"}
            </div>

            {!dia ? (
              <p className="text-muted-foreground text-sm">
                Os horários livres aparecem aqui.
              </p>
            ) : buscandoHorarios ? (
              <span className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
                Buscando horários…
              </span>
            ) : livres.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sem horário livre nesse dia. Tente outro.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {livres.map((livre) => (
                  <Button
                    key={livre.hora}
                    type="button"
                    size="sm"
                    variant={hora === livre.hora ? "default" : "outline"}
                    onClick={() => setHora(livre.hora)}
                  >
                    {livre.hora}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hora && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="publico-nome">Seu nome</FieldLabel>
                <Input
                  id="publico-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="publico-fone">WhatsApp</FieldLabel>
                <Input
                  id="publico-fone"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(maskWhatsapp(e.target.value))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="publico-obs">
                  Quer adiantar alguma coisa? (opcional)
                </FieldLabel>
                <Textarea
                  id="publico-obs"
                  rows={2}
                  maxLength={500}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </Field>
            </FieldGroup>

            <Button
              size="lg"
              disabled={!podeMarcar || marcar.isPending}
              onClick={() =>
                dia &&
                marcar.mutate({
                  orgSlug,
                  agendaSlug,
                  date: comoDia(dia),
                  time: hora,
                  name: nome.trim(),
                  phone: telefone,
                  notes: observacao.trim() || undefined,
                })
              }
            >
              {marcar.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar {hora}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Confirmacao({
  appointmentId,
  startsAt,
  agendaName,
  organizationName,
  onDesmarcado,
}: {
  appointmentId: string;
  startsAt: string;
  agendaName: string;
  organizationName: string;
  onDesmarcado: () => void;
}) {
  const desmarcar = useMutation(
    orpc.agenda.publica.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Horário desmarcado");
        onDesmarcado();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
      <CalendarCheck className="size-10 text-primary" />
      <div>
        <h1 className="font-semibold text-xl">Horário confirmado</h1>
        <p className="text-muted-foreground text-sm">
          {agendaName} · {organizationName}
        </p>
      </div>

      <Card className="w-full">
        <CardContent className="p-4">
          <p className="font-medium">
            {format(new Date(startsAt), "EEEE, d 'de' MMMM 'às' HH:mm", {
              locale: ptBR,
            })}
          </p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Guarde esta página: é por ela que dá para desmarcar.
      </p>

      <Button
        variant="outline"
        disabled={desmarcar.isPending}
        onClick={() => desmarcar.mutate({ appointmentId })}
      >
        {desmarcar.isPending && <Loader2 className="size-4 animate-spin" />}
        Desmarcar
      </Button>
    </div>
  );
}
