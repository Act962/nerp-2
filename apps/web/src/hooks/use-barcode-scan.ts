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
 *
 * O primeiro dígito é o único que não dá para classificar na hora — não existe
 * intervalo anterior para medir. Em vez de deixá-lo passar, guardamos o estado
 * do campo focado ANTES dele e DESFAZEMOS quando a rajada se confirma. Assim a
 * garantia do hook é absoluta: nenhuma leitura altera o campo focado.
 */
const FAST_KEY_MS = 45;
/**
 * Rajada confirmada já no SEGUNDO dígito: um intervalo abaixo de 45ms entre
 * duas teclas é inalcançável digitando (seriam mais de 22 teclas por segundo).
 *
 * Era 3, e por isso os TRÊS primeiros dígitos de toda leitura chegavam ao campo
 * focado. No PDV isso é a quantidade do item recém-adicionado, que ganha foco
 * JÁ SELECIONADA: o bipe substituía a quantidade em vez de somar, e a venda
 * fechava por menos do que o cliente levou.
 */
const BURST_CONFIRMED = 1;
/** Códigos curtos demais são digitação, não leitura. */
const MIN_CODE_LENGTH = 6;

type CampoEditavel = HTMLInputElement | HTMLTextAreaElement;

interface EstadoCampo {
  campo: CampoEditavel;
  valor: string;
  selecao: [number, number] | null;
}

function capturarCampoFocado(): EstadoCampo | null {
  const foco = document.activeElement;
  if (
    !(foco instanceof HTMLInputElement) &&
    !(foco instanceof HTMLTextAreaElement)
  ) {
    return null;
  }
  let selecao: [number, number] | null = null;
  try {
    // `input[type=number]` não expõe seleção e lança ao ser consultado.
    if (foco.selectionStart !== null && foco.selectionEnd !== null) {
      selecao = [foco.selectionStart, foco.selectionEnd];
    }
  } catch {
    selecao = null;
  }
  return { campo: foco, valor: foco.value, selecao };
}

/**
 * Devolve o campo ao estado anterior pelo setter NATIVO, seguido de um evento
 * `input`. Campo controlado do React só sincroniza assim: atribuir `.value`
 * direto não dispara `onChange`, e o valor antigo volta no render seguinte.
 */
function restaurarCampo({ campo, valor, selecao }: EstadoCampo): void {
  if (campo.value === valor) return;
  const prototipo =
    campo instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototipo, "value")?.set;
  if (setter) setter.call(campo, valor);
  else campo.value = valor;
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  if (selecao) {
    try {
      campo.setSelectionRange(selecao[0], selecao[1]);
    } catch {
      // Idem: tipo de campo que não aceita seleção programática.
    }
  }
}

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
  // Estado do campo focado antes do primeiro dígito da sequência em curso.
  const campoRef = useRef<EstadoCampo | null>(null);

  // `onScan` é redefinido a cada render pelo pai. No ref, o listener é
  // registrado UMA vez e mesmo assim chama sempre a versão atual.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const reiniciar = () => {
      bufferRef.current = "";
      fastCountRef.current = 0;
      campoRef.current = null;
    };

    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = event.timeStamp || performance.now();
      const gap = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;

      // Tecla SEGURADA repete na mesma cadência de um leitor (~30ms). Sem esta
      // saída, segurar "0" no campo de quantidade viraria leitura fantasma.
      if (event.repeat) {
        reiniciar();
        return;
      }

      if (event.key === "Enter") {
        const code = bufferRef.current;
        const wasBurst = fastCountRef.current >= BURST_CONFIRMED;
        reiniciar();
        if (wasBurst && code.length >= MIN_CODE_LENGTH) {
          event.preventDefault();
          event.stopPropagation();
          onScanRef.current(code);
        }
        return;
      }

      if (!/^\d$/.test(event.key)) {
        reiniciar();
        return;
      }

      if (gap > FAST_KEY_MS) {
        // Pausa longa: começou uma sequência nova, provavelmente humana. Guarda
        // o campo focado ANTES de o navegador inserir este dígito — é o que a
        // confirmação da rajada desfaz, logo abaixo.
        bufferRef.current = event.key;
        fastCountRef.current = 0;
        campoRef.current = capturarCampoFocado();
        return;
      }

      bufferRef.current += event.key;
      fastCountRef.current++;

      // Rajada confirmada: segura o dígito para ele não entrar no campo focado
      // e disparar consulta ao servidor a cada caractere.
      if (fastCountRef.current >= BURST_CONFIRMED) {
        event.preventDefault();
        event.stopPropagation();
        // O primeiro dígito da sequência já entrou no campo — desfaz.
        if (campoRef.current) {
          restaurarCampo(campoRef.current);
          campoRef.current = null;
        }
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
    // Só `enabled`: o listener não pode ser recriado no meio de uma rajada.
  }, [enabled]);
}
