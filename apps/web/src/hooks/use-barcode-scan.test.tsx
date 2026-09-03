import { render } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBarcodeScan } from "./use-barcode-scan";

const onScan = vi.fn();

function Harness({ enabled = true }: { enabled?: boolean }) {
  useBarcodeScan(enabled, onScan);
  return <input aria-label="busca" />;
}

function press(key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

const espera = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Leitor: dígitos sem pausa entre eles. */
function bipar(code: string) {
  for (const digit of code) press(digit);
  press("Enter");
}

describe("useBarcodeScan", () => {
  beforeEach(() => onScan.mockClear());

  it("reconhece a rajada do leitor e entrega o código inteiro", () => {
    render(<Harness />);

    bipar("7891234567895");

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("7891234567895");
  });

  // O ponto da correção: o PDV mantém o campo de busca focado, e a versão
  // anterior desistia dentro de input — todo bipe caía na busca textual.
  it("funciona mesmo com o foco dentro de um input", () => {
    const { getByLabelText } = render(<Harness />);
    (getByLabelText("busca") as HTMLInputElement).focus();

    bipar("7891234567895");

    expect(onScan).toHaveBeenCalledWith("7891234567895");
  });

  it("segura os dígitos da rajada para não entrarem no campo", () => {
    render(<Harness />);

    const eventos = "7891234567895".split("").map((d) => press(d));
    press("Enter");

    // Só o primeiro passa — não há intervalo anterior para classificá-lo.
    // Ele não fica no campo: é desfeito quando a rajada se confirma (ver o
    // bloco "campo focado" abaixo).
    expect(eventos[0].defaultPrevented).toBe(false);
    expect(eventos.at(-1)?.defaultPrevented).toBe(true);
  });

  it("digitação humana não vira scan", async () => {
    render(<Harness />);

    for (const digit of "789123") {
      press(digit);
      await espera(60);
    }
    press("Enter");

    expect(onScan).not.toHaveBeenCalled();
  });

  it("código curto demais é digitação, não leitura", () => {
    render(<Harness />);

    bipar("1234");

    expect(onScan).not.toHaveBeenCalled();
  });

  // Uma letra no meio não pode grudar os dois pedaços e inventar um código
  // que ninguém bipou. O que vier depois dela é uma leitura nova.
  it("letra no meio descarta o que veio antes", () => {
    render(<Harness />);

    for (const key of "789123") press(key);
    press("a");
    for (const key of "4567895") press(key);
    press("Enter");

    expect(onScan).not.toHaveBeenCalledWith("7891234567895");
    expect(onScan).toHaveBeenCalledWith("4567895");
  });

  it("desligado não escuta nada", () => {
    render(<Harness enabled={false} />);

    bipar("7891234567895");

    expect(onScan).not.toHaveBeenCalled();
  });

  // Regressão da causa raiz: o buffer em state re-renderizava a tela inteira a
  // cada dígito e recriava o listener no meio da rajada.
  it("não re-renderiza durante a rajada", () => {
    let renders = 0;
    function Contador() {
      renders++;
      useBarcodeScan(true, onScan);
      return null;
    }
    render(<Contador />);
    const antes = renders;

    bipar("7891234567895");

    expect(renders).toBe(antes);
  });
});

/**
 * Segundo bloco: o efeito da rajada sobre o CAMPO FOCADO.
 *
 * No PDV o campo focado costuma ser a quantidade do item recém-adicionado, e
 * ele ganha foco já SELECIONADO — dígito que escapa não soma, SUBSTITUI. O
 * cliente relatou exatamente isso: bipou duas vezes, ficou 1 unidade, e a
 * venda fechou por menos.
 *
 * Aqui o campo é CONTROLADO pelo React (como o do carrinho) e a ação padrão do
 * navegador é emulada à mão — o jsdom não insere o caractere sozinho, e é esse
 * efeito colateral que está sob teste.
 */
function Sonda({ onScan: aoLer }: { onScan: (code: string) => void }) {
  const [quantidade, setQuantidade] = useState("1");
  useBarcodeScan(true, aoLer);
  return (
    <input
      data-testid="quantidade"
      value={quantidade}
      onChange={(event) => setQuantidade(event.target.value)}
    />
  );
}

/** Escreve como o navegador escreveria, com o React enxergando a mudança. */
function escreverComoNavegador(campo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(campo, valor);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Keydown com `timeStamp` controlado + a ação padrão do navegador emulada. */
function tecla(
  campo: HTMLInputElement,
  key: string,
  at: number,
  options: { repeat?: boolean } = {},
): boolean {
  const evento = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    repeat: options.repeat ?? false,
  });
  Object.defineProperty(evento, "timeStamp", { value: at });
  campo.dispatchEvent(evento);
  if (!evento.defaultPrevented && /^\d$/.test(key)) {
    escreverComoNavegador(campo, campo.value + key);
  }
  return evento.defaultPrevented;
}

/** Rajada do leitor: dígitos a cada 10ms (leitor real fica abaixo de 30ms). */
function rajada(campo: HTMLInputElement, codigo: string, inicio = 1000) {
  const segurados = codigo
    .split("")
    .map((digito, i) => tecla(campo, digito, inicio + i * 10));
  tecla(campo, "Enter", inicio + codigo.length * 10);
  return segurados;
}

describe("useBarcodeScan — campo focado", () => {
  let quantidade: HTMLInputElement;

  beforeEach(() => {
    onScan.mockClear();
    const { getByTestId } = render(<Sonda onScan={onScan} />);
    quantidade = getByTestId("quantidade") as HTMLInputElement;
    quantidade.focus();
  });

  it("deixa o campo focado intacto depois da rajada", () => {
    rajada(quantidade, "003754");
    expect(quantidade.value).toBe("1");
  });

  it("segura os dígitos a partir do segundo", () => {
    const segurados = rajada(quantidade, "003754");
    expect(segurados.slice(1)).toEqual([true, true, true, true, true]);
  });

  it("entrega o mesmo código duas vezes seguidas", () => {
    rajada(quantidade, "003754", 1000);
    rajada(quantidade, "003754", 2000);
    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenNthCalledWith(2, "003754");
  });

  it("digitação humana chega ao campo e não vira leitura", () => {
    const segurados = "003754"
      .split("")
      .map((digito, i) => tecla(quantidade, digito, 1000 + i * 200));
    tecla(quantidade, "Enter", 1000 + 6 * 200);
    expect(onScan).not.toHaveBeenCalled();
    expect(segurados).toEqual([false, false, false, false, false, false]);
    expect(quantidade.value).toBe("1003754");
  });

  // Tecla segurada repete a ~30ms — mesma cadência de um leitor. Sem tratar o
  // `repeat`, segurar "0" na quantidade viraria uma leitura fantasma.
  it("auto-repeat de tecla não é confundido com rajada", () => {
    tecla(quantidade, "0", 1000);
    for (let i = 1; i < 6; i++) {
      tecla(quantidade, "0", 1000 + i * 30, { repeat: true });
    }
    tecla(quantidade, "Enter", 1200);
    expect(onScan).not.toHaveBeenCalled();
  });
});
