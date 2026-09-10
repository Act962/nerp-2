"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { type DadosDoLimite, lerLimiteDoPlano } from "../lib/limite-do-plano";

interface EstadoDoLimite {
  dados: DadosDoLimite | null;
  abrir: (dados: DadosDoLimite) => void;
  fechar: () => void;
}

/**
 * Um dialog só para o app inteiro, montado no `ModalProvider`: o erro de
 * limite pode sair de qualquer formulário ou importação, e cada um deles
 * abrindo o próprio dialog seria o mesmo componente copiado em dez lugares.
 */
export const useLimiteDoPlano = create<EstadoDoLimite>((set) => ({
  dados: null,
  abrir: (dados) => set({ dados }),
  fechar: () => set({ dados: null }),
}));

/**
 * Para o `onError` das mutações que cadastram: abre o dialog quando o erro é
 * de limite e devolve `true`; senão devolve `false` e quem chamou faz o toast
 * de sempre.
 */
export function tratarErroDeLimite(erro: unknown): boolean {
  const dados = lerLimiteDoPlano(erro);
  if (!dados) return false;
  useLimiteDoPlano.getState().abrir(dados);
  return true;
}

/** `onError` pronto: dialog se for limite, toast se não for. */
export function avisarErro(erro: { message: string }): void {
  if (tratarErroDeLimite(erro)) return;
  toast.error(erro.message);
}
