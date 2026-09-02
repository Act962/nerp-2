"use client";

import { useSyncExternalStore } from "react";
import { findTool } from "../data/catalog";
import { scroll } from "./store";

/**
 * Quem está aberto.
 *
 * O resto do estado do modo produto (a transição, o índice fracionário da
 * roleta) vive no objeto de scroll e é lido a 60fps sem passar pelo React.
 * Só a *identidade* do produto aberto precisa provocar re-render — é ela que
 * troca o texto na tela. Daí a separação: um valor discreto com assinantes,
 * e os contínuos no loop.
 */

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openProduct(id: string, angle: number) {
  const tool = findTool(id);
  if (!tool || scroll.product.id === id) return;

  scroll.product.id = id;
  scroll.product.angle = angle;
  scroll.product.feature = 0;
  scroll.product.featureCount = tool.features.length;
  scroll.product.hovered = null;
  emit();
}

export function closeProduct() {
  if (!scroll.product.id) return;
  scroll.product.id = null;
  scroll.product.hovered = null;
  emit();
}

/** O id do produto aberto, com re-render quando ele muda. */
export function useActiveProductId() {
  return useSyncExternalStore(
    subscribe,
    () => scroll.product.id,
    () => null,
  );
}

/** O produto aberto já resolvido no catálogo. */
export function useActiveProduct() {
  return findTool(useActiveProductId());
}
