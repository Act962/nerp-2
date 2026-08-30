"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { maskWhatsapp } from "@/lib/whatsapp";
import { orpc } from "@/lib/orpc";
import { useMarcarCompromisso } from "../hooks/use-agenda";

/**
 * O atendente marcando pelo ERP — cliente que ligou ou chegou no balcão.
 *
 * Os horários vêm da mesma consulta pública que o cliente vê. Uma segunda
 * fonte de horários aqui dentro seria a forma mais fácil de a tela interna
 * oferecer um encaixe que o servidor vai recusar.
 */
export function MarcarCompromisso({
  agendaId,
  orgSlug,
  agendaSlug,
}: {
  agendaId: string;
  orgSlug: string;
  agendaSlug: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");

  const marcar = useMarcarCompromisso();

  const { data: horarios, isFetching } = useQuery(
    orpc.agenda.publica.slots.queryOptions({
      input: { orgSlug, agendaSlug, date: data },
      enabled: aberto && Boolean(data),
    }),
  );

  const livres = horarios?.horarios ?? [];

  function fechar() {
    setAberto(false);
    setData("");
    setHora("");
    setNome("");
    setTelefone("");
    setObservacao("");
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => (estado ? setAberto(true) : fechar())}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus className="size-4" />
          Marcar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar compromisso</DialogTitle>
          <DialogDescription>
            Só aparecem os horários livres da grade. Dia fechado não oferece
            nenhum.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="marcar-data">Dia</FieldLabel>
            <Input
              id="marcar-data"
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
                setHora("");
              }}
            />
          </Field>

          {data && (
            <Field>
              <FieldLabel>Horário</FieldLabel>
              {isFetching ? (
                <span className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando horários…
                </span>
              ) : livres.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  Nenhum horário livre nesse dia.
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
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
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="marcar-nome">Nome</FieldLabel>
            <Input
              id="marcar-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="marcar-fone">WhatsApp</FieldLabel>
            <Input
              id="marcar-fone"
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={(e) => setTelefone(maskWhatsapp(e.target.value))}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="marcar-obs">Observação</FieldLabel>
            <Textarea
              id="marcar-obs"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            disabled={
              !data || !hora || !nome.trim() || !telefone || marcar.isPending
            }
            onClick={() =>
              marcar.mutate(
                {
                  agendaId,
                  date: data,
                  time: hora,
                  name: nome.trim(),
                  phone: telefone,
                  notes: observacao.trim() || undefined,
                  meetingType: "IN_PERSON",
                },
                { onSuccess: fechar },
              )
            }
          >
            {marcar.isPending && <Loader2 className="size-4 animate-spin" />}
            Marcar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
