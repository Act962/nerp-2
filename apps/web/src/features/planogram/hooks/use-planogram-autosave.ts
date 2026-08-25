"use client";

import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { usePlanogramStoreApi } from "../engine/planogram-store-context";
import type { EntityKind, PlanogramState } from "../engine/planogram-store";

export type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;

/**
 * Autosave incremental.
 *
 * A diferença central para o `use-floor-plan-scene` do store-map: lá o
 * `consumeDirty()` limpa a fila ANTES do await, então uma mutation que falha
 * leva as mudanças junto. Aqui a fila só é limpa DEPOIS do sucesso, e apenas
 * para as entidades cuja geração não mudou durante o voo — se o usuário editou
 * o mesmo item enquanto salvava, ele continua sujo.
 */
export function usePlanogramAutosave(planogramId: string) {
  const store = usePlanogramStoreApi();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const retryDelayRef = useRef(RETRY_BASE_MS);

  const bulkSave = useMutation(orpc.planogram.bulkSave.mutationOptions({}));

  useEffect(() => {
    function buildPayload(state: PlanogramState) {
      const { upserts, deletes } = (
        store.getState() as PlanogramState & {
          collectDirty: () => {
            upserts: { kind: EntityKind; id: string; generation: number }[];
            deletes: string[];
          };
        }
      ).collectDirty();

      const fixtures = [];
      const modules = [];
      const shelves = [];
      const items = [];

      for (const entry of upserts) {
        if (entry.kind === "fixture") {
          const node = state.fixtures[entry.id];
          if (node) fixtures.push(node);
        } else if (entry.kind === "module") {
          const node = state.modules[entry.id];
          if (node) modules.push(node);
        } else if (entry.kind === "shelf") {
          const node = state.shelves[entry.id];
          if (node) shelves.push(node);
        } else if (entry.kind === "item") {
          const node = state.items[entry.id];
          // Item sem prateleira é "não posicionado": existe no cliente mas não
          // pode ser gravado, porque shelfId é obrigatório no banco.
          if (node?.shelfId) items.push(node);
        }
      }

      const grouped = {
        fixtureIds: [] as string[],
        moduleIds: [] as string[],
        shelfIds: [] as string[],
        itemIds: [] as string[],
      };
      for (const key of deletes) {
        const [kind, id] = key.split(":");
        if (kind === "fixture") grouped.fixtureIds.push(id);
        else if (kind === "module") grouped.moduleIds.push(id);
        else if (kind === "shelf") grouped.shelfIds.push(id);
        else if (kind === "item") grouped.itemIds.push(id);
      }

      return { upserts, deletes, fixtures, modules, shelves, items, grouped };
    }

    async function flush() {
      if (inFlightRef.current) return;
      const state = store.getState();
      if (!state.hasPendingChanges()) return;

      const payload = buildPayload(state);
      inFlightRef.current = true;
      setSaveState("saving");

      try {
        await bulkSave.mutateAsync({
          planogramId,
          fixtures: payload.fixtures,
          modules: payload.modules,
          shelves: payload.shelves,
          items: payload.items,
          deletes: payload.grouped,
        });
        // Só agora limpa — e só o que não mudou durante o voo.
        store.getState().commitClean(payload.upserts, payload.deletes as never);
        retryDelayRef.current = RETRY_BASE_MS;
        setSaveState(store.getState().hasPendingChanges() ? "saving" : "saved");
      } catch {
        // Nada é limpo: as mudanças continuam na fila para a próxima tentativa.
        setSaveState("error");
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, RETRY_MAX_MS);
        timerRef.current = setTimeout(flush, delay);
      } finally {
        inFlightRef.current = false;
      }
    }

    const unsubscribe = store.subscribe((state, previous) => {
      // Só reagenda quando a fila muda — seleção e zoom não disparam save.
      if (
        state.dirty === previous.dirty &&
        state.deleted === previous.deleted
      ) {
        return;
      }
      if (!state.hasPendingChanges()) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [store, planogramId, bulkSave]);

  // Avisa se o usuário tentar sair com alterações não salvas.
  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (store.getState().hasPendingChanges()) event.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [store]);

  return { saveState };
}
