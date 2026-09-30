"use client";

import { useEffect } from "react";

export const CLASSE_VITRINE_CLARA = "vitrine-clara";

/**
 * Mantém a vitrine no tema claro, qualquer que seja o tema do admin.
 *
 * O layout da loja já põe a classe no parse do HTML (script inline, antes da
 * primeira pintura). Este efeito cobre a navegação pelo cliente: entra na
 * loja, põe; sai dela, tira — e o admin volta ao tema que a pessoa escolheu.
 */
export function VitrineClara() {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add(CLASSE_VITRINE_CLARA);
    return () => raiz.classList.remove(CLASSE_VITRINE_CLARA);
  }, []);

  return null;
}
