"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import dayjs from "dayjs";
import {
  Factory,
  MapPin,
  Pencil,
  Store as StoreIcon,
  Trash2,
  Users,
} from "lucide-react";
import {
  useCalendarEvent,
  useDeleteCalendarEvent,
} from "../hooks/use-calendario";
import { STATUS_BADGE, STATUS_LABEL, TYPE_LABEL } from "../lib/calendar-colors";
import { longDateLabel } from "../lib/calendar-range";
import { CalendarChecklist } from "./calendar-checklist";
import { CalendarChecklistMatrix } from "./calendar-checklist-matrix";

function periodLabel(startsAt: string, endsAt: string, isAllDay: boolean) {
  const start = dayjs(startsAt);
  const end = dayjs(endsAt);
  const sameDay = start.isSame(end, "day");

  if (isAllDay) {
    return sameDay
      ? longDateLabel(start)
      : `${start.format("DD/MM")} até ${end.format("DD/MM/YYYY")}`;
  }
  return sameDay
    ? `${longDateLabel(start)} · ${start.format("HH:mm")}–${end.format("HH:mm")}`
    : `${start.format("DD/MM HH:mm")} até ${end.format("DD/MM/YYYY HH:mm")}`;
}

export function CalendarEventSheet({
  eventId,
  open,
  onOpenChange,
  onEdit,
}: {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = leitura pura (é o caso do promotor). */
  onEdit?: (eventId: string) => void;
}) {
  const { data, isLoading } = useCalendarEvent(open ? eventId : null);
  const remove = useDeleteCalendarEvent();

  const event = data?.event;
  const canManage = data?.canManage ?? false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading || !event ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">{event.title}</SheetTitle>
              <SheetDescription>
                {periodLabel(event.startsAt, event.endsAt, event.isAllDay)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{TYPE_LABEL[event.type]}</Badge>
                <Badge className={STATUS_BADGE[event.status]}>
                  {STATUS_LABEL[event.status]}
                </Badge>
                {event.visibility === "LINKED" && (
                  <Badge variant="secondary">Só equipe vinculada</Badge>
                )}
              </div>

              {event.location && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4 shrink-0" /> {event.location}
                </p>
              )}

              {event.description && (
                <p className="whitespace-pre-wrap text-sm">
                  {event.description}
                </p>
              )}

              {event.stores.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <StoreIcon className="size-3.5" /> Clientes
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {event.stores.map((store) => (
                      <Badge key={store.id} variant="secondary">
                        {store.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {event.suppliers.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Factory className="size-3.5" /> Indústrias
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {event.suppliers.map((supplier) => (
                      <Badge key={supplier.id} variant="secondary">
                        {supplier.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {event.assignees.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="size-3.5" /> Promotores escalados
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {event.assignees.map((member) => (
                      <Badge key={member.id} variant="secondary">
                        {member.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <CalendarChecklist
                items={event.checklistItems}
                stores={event.stores}
              />

              {canManage && event.checklistItems.length > 0 && (
                <CalendarChecklistMatrix eventId={event.id} />
              )}

              {canManage && (
                <div className="flex gap-2 border-t pt-4">
                  {onEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => onEdit(event.id)}
                    >
                      <Pencil className="size-4" /> Editar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir "${event.title}"? O checklist e as marcações da equipe vão junto.`,
                        )
                      ) {
                        remove.mutate(
                          { id: event.id },
                          { onSuccess: () => onOpenChange(false) },
                        );
                      }
                    }}
                  >
                    <Trash2 className="size-4" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
