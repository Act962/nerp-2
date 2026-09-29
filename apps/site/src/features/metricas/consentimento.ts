"use client";

import { useSyncExternalStore } from "react";
import { gravarLocal, lerLocal } from "./armazenamento";

/**
 * O consentimento para cookies de marketing (pixels da Meta e do Google).
 *
 * Só eles dependem do "aceito": as métricas próprias do site não saem daqui,
 * não cruzam com outro site e não identificam ninguém — o ID do visitante é
 * um número aleatório deste navegador.
 */

const CHAVE = "orbita:consentimento";

export type Consentimento = "aceito" | "recusado" | null;

const ouvintes = new Set<() => void>();

function ler(): Consentimento {
  const valor = lerLocal(CHAVE);
  return valor === "aceito" || valor === "recusado" ? valor : null;
}

export function definirConsentimento(valor: Consentimento) {
  const anterior = ler();
  gravarLocal(CHAVE, valor);
  for (const ouvinte of ouvintes) ouvinte();
  // Pixel já carregado não descarrega: quem volta atrás recarrega a página
  // limpa, sem os scripts de terceiro.
  if (anterior === "aceito" && valor === "recusado") window.location.reload();
}

/** Reabre o aviso (o link "Preferências de cookies" do rodapé). */
export function reabrirAvisoDeCookies() {
  gravarLocal(CHAVE, null);
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** `undefined` no servidor: sem saber, o aviso não pisca na primeira pintura. */
export function useConsentimento(): Consentimento | undefined {
  return useSyncExternalStore<Consentimento | undefined>(
    assinar,
    ler,
    () => undefined,
  );
}
