"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface CalendarFilters {
  types?: string[];
  statuses?: string[];
  storeIds?: string[];
  supplierIds?: string[];
  search?: string;
}

type ListInput = Parameters<typeof orpc.calendar.list.queryOptions>[0]["input"];

export function useCalendarList(
  range: { from: string; to: string },
  filters?: CalendarFilters,
) {
  const query = useQuery(
    orpc.calendar.list.queryOptions({
      input: { ...range, ...filters } as ListInput,
    }),
  );
  return {
    events: query.data?.events ?? [],
    notes: query.data?.notes ?? [],
    canManage: query.data?.canManage ?? false,
    isLoading: query.isPending,
  };
}

export function useCalendarEvent(id: string | null) {
  const query = useQuery({
    ...orpc.calendar.get.queryOptions({ input: { id: id ?? "" } }),
    enabled: !!id,
  });
  return { data: query.data, isLoading: query.isPending };
}

export function useCalendarFilterOptions() {
  const query = useQuery(
    orpc.calendar.filterOptions.queryOptions({ input: {} }),
  );
  return {
    stores: query.data?.stores ?? [],
    suppliers: query.data?.suppliers ?? [],
    members: query.data?.members ?? [],
    ufs: query.data?.ufs ?? [],
    canManage: query.data?.canManage ?? false,
    isLoading: query.isPending,
  };
}

/**
 * Invalida tudo que depende dos eventos.
 *
 * A queryKey do `list` inclui a janela de datas E os filtros, então invalidar
 * por prefixo é o único jeito de acertar a consulta que está na tela.
 */
function useInvalidateCalendar() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.calendar.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.calendar.get.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.calendar.checklistProgress.key(),
    });
  };
}

export function useSaveCalendarEvent() {
  const invalidate = useInvalidateCalendar();
  const create = useMutation(
    orpc.calendar.create.mutationOptions({
      onSuccess: () => {
        toast.success("Evento criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const update = useMutation(
    orpc.calendar.update.mutationOptions({
      onSuccess: () => {
        toast.success("Evento atualizado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  return { create, update, isPending: create.isPending || update.isPending };
}

export function useDeleteCalendarEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation(
    orpc.calendar.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Evento excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useMoveCalendarEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation(
    orpc.calendar.move.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => {
        toast.error(error.message);
        // Revalida também no erro: o card já pulou de dia na tela otimista e
        // precisa voltar para onde realmente está.
        invalidate();
      },
    }),
  );
}

export function useSetChecklist() {
  const invalidate = useInvalidateCalendar();
  return useMutation(
    orpc.calendar.setChecklist.mutationOptions({
      onSuccess: () => {
        toast.success("Checklist salvo");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Sem toast: o promotor marca vários itens seguidos e uma pilha de toasts
// atrapalharia — o próprio check é o retorno visual.
export function useToggleChecklistItem() {
  const invalidate = useInvalidateCalendar();
  return useMutation(
    orpc.calendar.toggleChecklistItem.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useChecklistProgress(eventId: string | null, enabled: boolean) {
  const query = useQuery({
    ...orpc.calendar.checklistProgress.queryOptions({
      input: { eventId: eventId ?? "" },
    }),
    enabled: !!eventId && enabled,
  });
  return {
    items: query.data?.items ?? [],
    rows: query.data?.rows ?? [],
    isLoading: query.isPending,
  };
}

export function useSaveCalendarNote() {
  const invalidate = useInvalidateCalendar();
  const create = useMutation(
    orpc.calendar.createNote.mutationOptions({
      onSuccess: () => {
        toast.success("Anotação salva");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const update = useMutation(
    orpc.calendar.updateNote.mutationOptions({
      onSuccess: () => {
        toast.success("Anotação atualizada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  return { create, update, isPending: create.isPending || update.isPending };
}

export function useDeleteCalendarNote() {
  const invalidate = useInvalidateCalendar();
  return useMutation(
    orpc.calendar.deleteNote.mutationOptions({
      onSuccess: () => {
        toast.success("Anotação excluída");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
