import { render } from "@testing-library/react";
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

    // Os dois primeiros ainda passam (a rajada só se confirma no terceiro).
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
