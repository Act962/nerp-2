"use client";

import { create } from "zustand";
import { authClient } from "@/lib/auth-client";

/**
 * O diálogo "crie sua conta com o Google" — um só para o app inteiro,
 * montado no `ModalProvider`. Abre quando o servidor recusa algo por a
 * organização ser de teste (`CONTA_NAO_VERIFICADA`), ou por vontade da
 * pessoa (banner, botão de compra).
 */

interface EstadoDoVinculo {
  aberto: boolean;
  motivo: string | null;
  abrir: (motivo?: string) => void;
  fechar: () => void;
}

export const useVincularConta = create<EstadoDoVinculo>((set) => ({
  aberto: false,
  motivo: null,
  abrir: (motivo) => set({ aberto: true, motivo: motivo ?? null }),
  fechar: () => set({ aberto: false, motivo: null }),
}));

export function lerContaNaoVerificada(
  erro: unknown,
): { motivo: string } | null {
  if (typeof erro !== "object" || erro === null || !("data" in erro)) {
    return null;
  }
  const dados = (erro as { data?: { code?: unknown; motivo?: unknown } }).data;
  if (dados?.code !== "CONTA_NAO_VERIFICADA") return null;
  return { motivo: typeof dados.motivo === "string" ? dados.motivo : "" };
}

/** Para o `onError`: abre o diálogo e devolve `true` quando o erro é este. */
export function tratarErroDeContaNaoVerificada(erro: unknown): boolean {
  const dados = lerContaNaoVerificada(erro);
  if (!dados) return false;
  useVincularConta.getState().abrir(dados.motivo);
  return true;
}

/**
 * Manda para o Google com a sessão anônima ativa. O plugin `anonymous` vê o
 * callback, chama `onLinkAccount` e a organização passa para a conta nova.
 */
export async function vincularComGoogle(voltarPara = "/dashboard?vinculado=1") {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: voltarPara,
  });
}
