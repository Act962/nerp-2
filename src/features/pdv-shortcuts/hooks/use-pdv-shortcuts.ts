"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  type PdvBindings,
  bindingFiresInInputs,
  keyFromEvent,
  resolveBindings,
} from "../shortcuts";

// Atalhos efetivos: padrões de fábrica + overrides da org.
export function usePdvShortcuts() {
  const query = useQuery(
    orpc.pdvSettings.getShortcuts.queryOptions({ input: {} }),
  );
  const raw = query.data?.bindings ?? null;
  // `resolveBindings` cria um objeto novo a cada chamada; sem memoizar, a
  // referência muda todo render e derruba efeitos que dependem de `bindings`
  // num loop ("Maximum update depth exceeded"). `raw` é estável (react-query).
  const bindings = useMemo(() => resolveBindings(raw), [raw]);
  return { bindings, isLoading: query.isPending };
}

export function useUpdatePdvShortcuts() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.pdvSettings.updateShortcuts.mutationOptions({
      onSuccess: () => {
        toast.success("Atalhos salvos");
        queryClient.invalidateQueries({
          queryKey: orpc.pdvSettings.getShortcuts.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

// Registra o listener global e dispara o handler da ação cuja tecla casa. Usa
// refs para não reassinar o listener a cada render.
export function useHotkeys(
  bindings: PdvBindings,
  handlers: Partial<Record<keyof PdvBindings, () => void>>,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const pressed = keyFromEvent(event);
      for (const [action, key] of Object.entries(bindingsRef.current)) {
        if (key !== pressed) continue;
        // Atalho "simples" não sequestra a digitação de um campo de texto.
        if (!bindingFiresInInputs(key) && isEditable(event.target)) return;
        const handler = handlersRef.current[action as keyof PdvBindings];
        if (handler) {
          event.preventDefault();
          handler();
        }
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
