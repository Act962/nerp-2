"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useAgendas() {
  return useQuery(orpc.agenda.list.queryOptions({ input: {} }));
}

export function useAgenda(agendaId: string | null) {
  return useQuery(
    orpc.agenda.get.queryOptions({
      input: { agendaId: agendaId ?? "" },
      enabled: Boolean(agendaId),
    }),
  );
}

export function useCompromissos(input: {
  agendaId?: string;
  de: string;
  ate: string;
}) {
  return useQuery(orpc.agenda.appointment.list.queryOptions({ input }));
}

export function useCriarAgenda() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.agenda.create.mutationOptions({
      onSuccess: () => {
        toast.success("Agenda criada");
        queryClient.invalidateQueries({ queryKey: orpc.agenda.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useEditarAgenda() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.agenda.update.mutationOptions({
      onSuccess: () => {
        toast.success("Agenda atualizada");
        queryClient.invalidateQueries({ queryKey: orpc.agenda.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSalvarGrade() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.agenda.setAvailability.mutationOptions({
      onSuccess: () => {
        toast.success("Horários salvos");
        queryClient.invalidateQueries({ queryKey: orpc.agenda.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useBloquearData() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.agenda.setDateOverride.mutationOptions({
      onSuccess: (_, variables) => {
        toast.success(variables.isBlocked ? "Dia fechado" : "Dia reaberto");
        queryClient.invalidateQueries({ queryKey: orpc.agenda.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useMarcarCompromisso() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.agenda.appointment.create.mutationOptions({
      onSuccess: () => {
        toast.success("Compromisso marcado");
        queryClient.invalidateQueries({ queryKey: orpc.agenda.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCancelarCompromisso() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.agenda.appointment.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Compromisso cancelado");
        queryClient.invalidateQueries({ queryKey: orpc.agenda.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
