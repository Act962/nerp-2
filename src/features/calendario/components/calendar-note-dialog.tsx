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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Dayjs } from "dayjs";
import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  useDeleteCalendarNote,
  useSaveCalendarNote,
} from "../hooks/use-calendario";
import type { CalendarNoteItem } from "../lib/calendar-item";
import {
  nextHalfHour,
  toInstant,
  toLocalDay,
  toLocalTime,
} from "../lib/calendar-range";

const noteSchema = z.object({
  title: z.string().trim().min(1, "Informe o título"),
  content: z.string().trim().max(2000).optional(),
  day: z.string().min(1, "Informe a data"),
  time: z.string().optional(),
  isAllDay: z.boolean(),
});

type NoteForm = z.infer<typeof noteSchema>;

interface NoteTaskDraft {
  /** Ausente = item novo, ainda sem linha no banco. */
  id?: string;
  title: string;
  isDone: boolean;
}

/**
 * Anotação privada do promotor — só ele vê, inclusive do owner para baixo.
 * É o que faz a agenda ser usada de verdade.
 */
export function CalendarNoteDialog({
  note,
  defaultDay,
  defaultTimed,
  open,
  onOpenChange,
}: {
  note: CalendarNoteItem | null;
  defaultDay: Dayjs;
  /** Abre já com horário, em vez de "dia todo" — usado ao tocar num dia. */
  defaultTimed?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, isPending } = useSaveCalendarNote();
  const remove = useDeleteCalendarNote();

  const [tasks, setTasks] = useState<NoteTaskDraft[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", isAllDay: true, day: "", time: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: note?.title ?? "",
      content: note?.content ?? "",
      day: note ? toLocalDay(note.startsAt) : defaultDay.format("YYYY-MM-DD"),
      time: note
        ? note.isAllDay
          ? nextHalfHour()
          : toLocalTime(note.startsAt)
        : nextHalfHour(),
      isAllDay: note ? note.isAllDay : !defaultTimed,
    });
    setTasks(note?.tasks ?? []);
    setAdding(false);
    setDraft("");
  }, [open, note, defaultDay, defaultTimed, form]);

  const isAllDay = form.watch("isAllDay");
  const doneCount = tasks.filter((task) => task.isDone).length;

  const commitDraft = () => {
    const title = draft.trim();
    if (!title) return;
    setTasks((current) => [...current, { title, isDone: false }]);
    setDraft("");
    addInputRef.current?.focus();
  };

  const onSubmit = (data: NoteForm) => {
    const payload = {
      title: data.title,
      content: data.content?.trim() ? data.content : null,
      color: null,
      isAllDay: data.isAllDay,
      startsAt: toInstant(data.day, data.isAllDay ? "00:00" : data.time),
      endsAt: data.isAllDay
        ? toInstant(data.day, "23:59")
        : toInstant(data.day, data.time),
      tasks: tasks
        .filter((task) => task.title.trim().length > 0)
        .map((task) => ({
          id: task.id,
          title: task.title.trim(),
          isDone: task.isDone,
        })),
    };

    const done = { onSuccess: () => onOpenChange(false) };
    if (note) update.mutate({ ...payload, id: note.id }, done);
    else create.mutate(payload, done);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {note ? "Editar anotação" : "Nova anotação"}
          </DialogTitle>
          <DialogDescription>
            Só você vê esta anotação — nem a coordenação.
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
                    placeholder="Ex.: passar no Coelho às 14h"
                  />
                  {fieldState.error && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                </Field>
              )}
            />

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

            <div className="flex gap-2">
              <Controller
                name="day"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field className="flex-1">
                    <FieldLabel htmlFor={field.name}>Data</FieldLabel>
                    <Input {...field} id={field.name} type="date" />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              {/* Sempre visível, desabilitado no "dia todo": esconder o campo
                fazia parecer que a anotação não aceitava horário. */}
              <Controller
                name="time"
                control={form.control}
                render={({ field }) => (
                  <Field className="w-32">
                    <FieldLabel htmlFor={field.name}>Hora</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="time"
                      disabled={isAllDay}
                    />
                  </Field>
                )}
              />
            </div>

            <Controller
              name="content"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Observação</FieldLabel>
                  <Textarea {...field} id={field.name} rows={3} />
                </Field>
              )}
            />

            {/* Checklist da anotação, no espírito das sub-ações: contador,
              barra de progresso e um campo que só aparece ao adicionar. */}
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel className="uppercase tracking-wide">
                  Checklist
                  {tasks.length > 0 && (
                    <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
                      {doneCount}/{tasks.length}
                    </span>
                  )}
                </FieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setAdding(true);
                    setTimeout(() => addInputRef.current?.focus(), 0);
                  }}
                >
                  <Plus className="size-3.5" /> Adicionar
                </Button>
              </div>

              {tasks.length > 0 && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${(doneCount / tasks.length) * 100}%`,
                    }}
                  />
                </div>
              )}

              <ul className="space-y-1">
                {tasks.map((task, index) => (
                  <li
                    key={task.id ?? `novo-${index}`}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      checked={task.isDone}
                      aria-label={`Concluir ${task.title || "item"}`}
                      onCheckedChange={(value) =>
                        setTasks((current) =>
                          current.map((entry, position) =>
                            position === index
                              ? { ...entry, isDone: value === true }
                              : entry,
                          ),
                        )
                      }
                    />
                    <Input
                      value={task.title}
                      className={
                        task.isDone
                          ? "h-8 text-muted-foreground line-through"
                          : "h-8"
                      }
                      onChange={(event) =>
                        setTasks((current) =>
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
                      className="size-8 shrink-0"
                      aria-label="Remover item"
                      onClick={() =>
                        setTasks((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              {adding && (
                <div className="flex items-center gap-2">
                  <span className="size-4 shrink-0" />
                  <Input
                    ref={addInputRef}
                    value={draft}
                    placeholder="Título do item…"
                    className="h-8"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter adiciona e mantém o campo aberto: item de
                      // checklist raramente vem sozinho.
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitDraft();
                      }
                      if (event.key === "Escape") {
                        setAdding(false);
                        setDraft("");
                      }
                    }}
                    onBlur={() => {
                      if (!draft.trim()) setAdding(false);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Confirmar item"
                    disabled={!draft.trim()}
                    onClick={commitDraft}
                  >
                    <Check className="size-4" />
                  </Button>
                </div>
              )}
            </Field>
          </FieldGroup>

          <DialogFooter className="gap-2 sm:justify-between">
            {note ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { id: note.id },
                    { onSuccess: () => onOpenChange(false) },
                  )
                }
              >
                <Trash2 className="size-4" /> Excluir
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
