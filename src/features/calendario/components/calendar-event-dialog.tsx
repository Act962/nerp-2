"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Dayjs } from "dayjs";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  useCalendarEvent,
  useCalendarFilterOptions,
  useSaveCalendarEvent,
  useSetChecklist,
} from "../hooks/use-calendario";
import { STATUS_LABEL, TYPE_LABEL } from "../lib/calendar-colors";
import type { EventStatus, EventType } from "../lib/calendar-item";
import { toInstant, toLocalDay, toLocalTime } from "../lib/calendar-range";
import { CalendarTargetPicker } from "./calendar-target-picker";

const eventSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título do evento"),
    description: z.string().trim().max(2000).optional(),
    type: z.string(),
    status: z.string(),
    visibility: z.enum(["ORG", "LINKED"]),
    location: z.string().trim().max(200).optional(),
    isAllDay: z.boolean(),
    startDay: z.string().min(1, "Informe a data de início"),
    startTime: z.string().optional(),
    endDay: z.string().min(1, "Informe a data de fim"),
    endTime: z.string().optional(),
  })
  .refine((data) => data.endDay >= data.startDay, {
    message: "O fim não pode ser antes do início",
    path: ["endDay"],
  });

type EventForm = z.infer<typeof eventSchema>;

interface ChecklistDraft {
  id?: string;
  title: string;
  isRequired: boolean;
}

export function CalendarEventDialog({
  eventId,
  defaultDay,
  open,
  onOpenChange,
}: {
  /** null = criar. */
  eventId: string | null;
  defaultDay: Dayjs;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { stores, suppliers, members } = useCalendarFilterOptions();
  const { data } = useCalendarEvent(open && eventId ? eventId : null);
  const { create, update, isPending } = useSaveCalendarEvent();
  const setChecklist = useSetChecklist();

  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [checklist, setChecklistDraft] = useState<ChecklistDraft[]>([]);

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      type: "ACAO_PDV",
      status: "PLANEJADO",
      visibility: "ORG",
      isAllDay: true,
      startDay: "",
      endDay: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    const event = eventId ? data?.event : null;
    const day = defaultDay.format("YYYY-MM-DD");

    form.reset({
      title: event?.title ?? "",
      description: event?.description ?? "",
      type: event?.type ?? "ACAO_PDV",
      status: event?.status ?? "PLANEJADO",
      visibility: event?.visibility ?? "ORG",
      location: event?.location ?? "",
      isAllDay: event?.isAllDay ?? true,
      startDay: event ? toLocalDay(event.startsAt) : day,
      startTime: event && !event.isAllDay ? toLocalTime(event.startsAt) : "",
      endDay: event ? toLocalDay(event.endsAt) : day,
      endTime: event && !event.isAllDay ? toLocalTime(event.endsAt) : "",
    });
    setStoreIds(event?.stores.map((store) => store.id) ?? []);
    setSupplierIds(event?.suppliers.map((supplier) => supplier.id) ?? []);
    setMemberIds(event?.assignees.map((member) => member.id) ?? []);
    setChecklistDraft(
      event?.checklistItems.map((item) => ({
        id: item.id,
        title: item.title,
        isRequired: item.isRequired,
      })) ?? [],
    );
  }, [open, eventId, data, defaultDay, form]);

  const isAllDay = form.watch("isAllDay");

  const onSubmit = (values: EventForm) => {
    const payload = {
      title: values.title,
      description: values.description?.trim() ? values.description : null,
      type: values.type as EventType,
      status: values.status as EventStatus,
      visibility: values.visibility,
      color: null,
      location: values.location?.trim() ? values.location : null,
      isAllDay: values.isAllDay,
      startsAt: toInstant(
        values.startDay,
        values.isAllDay ? "00:00" : values.startTime,
      ),
      endsAt: toInstant(
        values.endDay,
        values.isAllDay ? "23:59" : values.endTime,
      ),
      storeIds,
      supplierIds,
      memberIds,
    };

    // O checklist é salvo depois do evento porque precisa do id — e só quando
    // há itens ou quando havia e foram removidos.
    const saveChecklist = (id: string) => {
      const had = (data?.event.checklistItems.length ?? 0) > 0;
      if (checklist.length === 0 && !had) {
        onOpenChange(false);
        return;
      }
      setChecklist.mutate(
        {
          eventId: id,
          items: checklist
            .filter((item) => item.title.trim().length > 0)
            .map((item) => ({
              id: item.id,
              title: item.title.trim(),
              isRequired: item.isRequired,
            })),
        },
        { onSuccess: () => onOpenChange(false) },
      );
    };

    if (eventId) {
      update.mutate(
        { ...payload, id: eventId },
        { onSuccess: (result) => saveChecklist(result.id) },
      );
    } else {
      create.mutate(payload, {
        onSuccess: (result) => saveChecklist(result.id),
      });
    }
  };

  const busy = isPending || setChecklist.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{eventId ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            Eventos aparecem no calendário da equipe e no App Promotor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Título</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Ex.: Ação de Páscoa — ponta de gôndola"
                  />
                  {fieldState.error && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={field.name}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              <Controller
                name="status"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Situação</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={field.name}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <Controller
              name="isAllDay"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch
                    id={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <FieldLabel htmlFor={field.name}>Dia todo</FieldLabel>
                </Field>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2">
                <Controller
                  name="startDay"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field className="flex-1">
                      <FieldLabel htmlFor={field.name}>Início</FieldLabel>
                      <Input {...field} id={field.name} type="date" />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
                {!isAllDay && (
                  <Controller
                    name="startTime"
                    control={form.control}
                    render={({ field }) => (
                      <Field className="w-28">
                        <FieldLabel htmlFor={field.name}>Hora</FieldLabel>
                        <Input {...field} id={field.name} type="time" />
                      </Field>
                    )}
                  />
                )}
              </div>

              <div className="flex gap-2">
                <Controller
                  name="endDay"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field className="flex-1">
                      <FieldLabel htmlFor={field.name}>Fim</FieldLabel>
                      <Input {...field} id={field.name} type="date" />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
                {!isAllDay && (
                  <Controller
                    name="endTime"
                    control={form.control}
                    render={({ field }) => (
                      <Field className="w-28">
                        <FieldLabel htmlFor={field.name}>Hora</FieldLabel>
                        <Input {...field} id={field.name} type="time" />
                      </Field>
                    )}
                  />
                )}
              </div>
            </div>

            <Controller
              name="location"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Local</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Ex.: Loja Centro — corredor 4"
                  />
                </Field>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Clientes</FieldLabel>
                <CalendarTargetPicker
                  label="Clientes"
                  options={stores}
                  value={storeIds}
                  onChange={setStoreIds}
                  emptyLabel="Todos os clientes"
                />
              </Field>
              <Field>
                <FieldLabel>Indústrias</FieldLabel>
                <CalendarTargetPicker
                  label="Indústrias"
                  options={suppliers}
                  value={supplierIds}
                  onChange={setSupplierIds}
                  emptyLabel="Todas as indústrias"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Promotores escalados</FieldLabel>
              <FieldDescription>
                Quem for escalado vê a ação e marca o checklist, mesmo sem
                vínculo com a loja ou a marca.
              </FieldDescription>
              <CalendarTargetPicker
                label="Promotores"
                options={members}
                value={memberIds}
                onChange={setMemberIds}
                emptyLabel="Ninguém escalado"
              />
            </Field>

            <Controller
              name="visibility"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Quem vê</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORG">Toda a empresa</SelectItem>
                      <SelectItem value="LINKED">
                        Só quem atende os clientes/indústrias marcados
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {field.value === "LINKED"
                      ? "Sem cliente nem indústria marcados, ninguém além de você verá o evento."
                      : "Aparece para todo mundo, mesmo com clientes marcados."}
                  </FieldDescription>
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                  <Textarea {...field} id={field.name} rows={3} />
                </Field>
              )}
            />

            <Field>
              <FieldLabel>Checklist de atividades</FieldLabel>
              <FieldDescription>
                Cada promotor marca a sua — numa ação em várias lojas, dá para
                ver quem executou onde.
              </FieldDescription>
              <div className="space-y-1.5">
                {checklist.map((item, index) => (
                  <div
                    key={item.id ?? `novo-${index}`}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={item.title}
                      placeholder="Ex.: montar ponta de gôndola"
                      onChange={(event) =>
                        setChecklistDraft((current) =>
                          current.map((entry, position) =>
                            position === index
                              ? { ...entry, title: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover item"
                      onClick={() =>
                        setChecklistDraft((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setChecklistDraft((current) => [
                      ...current,
                      { title: "", isRequired: true },
                    ])
                  }
                >
                  <Plus className="size-4" /> Adicionar atividade
                </Button>
              </div>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner />}
              Salvar evento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
