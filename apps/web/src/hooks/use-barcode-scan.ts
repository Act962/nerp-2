"use client";

import { useEffect, useRef } from "react";

/**
 * Leitura de código de barras por leitor que emula teclado.
 *
 * Leitor dispara os dígitos em RAJADA — tipicamente menos de 30ms entre teclas.
 * Digitação humana raramente desce de 80ms. Esse intervalo é o único sinal
 * confiável para separar bipe de digitação, e é o que permite reconhecer o
 * scan mesmo com o campo de busca focado — que é o estado normal do PDV, onde
 * a versão anterior deste hook simplesmente desistia (`instanceof
 * HTMLInputElement` e volta), fazendo todo bipe cair na busca textual.
 */
const FAST_KEY_MS = 45;
/** Rajada confirmada: a partir daqui os dígitos não chegam ao input. */
const BURST_CONFIRMED = 3;
/** Códigos curtos demais são digitação, não leitura. */
const MIN_CODE_LENGTH = 6;

export function useBarcodeScan(
  enabled: boolean,
  onScan: (code: string) => void,
): void {
  // Buffer em ref, NÃO em state: um EAN de 13 dígitos causava 13 renders da
  // tela inteira do PDV antes mesmo do Enter chegar — e, com `buffer` nas
  // dependências do efeito, 13 remoções e registros do listener no meio da
  // rajada, o que ainda derrubava dígitos.
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const fastCountRef = useRef(0);

  // `onScan` é redefinido a cada render pelo pai. No ref, o listener é
  // registrado UMA vez e mesmo assim chama sempre a versão atual.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = event.timeStamp || performance.now();
      const gap = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;

      if (event.key === "Enter") {
        const code = bufferRef.current;
        const wasBurst = fastCountRef.current >= BURST_CONFIRMED;
        bufferRef.current = "";
        fastCountRef.current = 0;
        if (wasBurst && code.length >= MIN_CODE_LENGTH) {
          event.preventDefault();
          event.stopPropagation();
          onScanRef.current(code);
        }
        return;
      }

      if (!/^\d$/.test(event.key)) {
        bufferRef.current = "";
        fastCountRef.current = 0;
        return;
      }

      if (gap > FAST_KEY_MS) {
        // Pausa longa: começou uma sequência nova, provavelmente humana.
        bufferRef.current = event.key;
        fastCountRef.current = 0;
        return;
      }

      bufferRef.current += event.key;
      fastCountRef.current++;

      // Rajada já confirmada: segura o dígito para ele não entrar no campo de
      // busca e disparar consulta ao servidor a cada caractere.
      if (fastCountRef.current >= BURST_CONFIRMED) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
    // Só `enabled`: o listener não pode ser recriado no meio de uma rajada.
  }, [enabled]);
}
