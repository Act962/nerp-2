import { describe, expect, it, vi } from "vitest";
import { abrirGatilho, acharAlvo, containerDoAlvo } from "./alvo";

/**
 * O `abrirGatilho` existe por causa de uma diferença real entre as bibliotecas
 * da tela: o menu abre no clique, as abas do Radix abrem no `pointerdown`. Um
 * clique programático nas abas não faz nada, e o passo seguinte fica esperando
 * para sempre um alvo que nunca monta.
 */
describe("abrirGatilho", () => {
  it("manda ponteiro E clique — quem escuta um dos dois é atendido", () => {
    const botao = document.createElement("button");
    document.body.append(botao);

    const eventos: string[] = [];
    botao.addEventListener("pointerdown", () => eventos.push("pointerdown"));
    botao.addEventListener("mousedown", () => eventos.push("mousedown"));
    botao.addEventListener("click", () => eventos.push("click"));

    abrirGatilho(botao);

    expect(eventos).toEqual(["pointerdown", "mousedown", "click"]);
    botao.remove();
  });

  it("os eventos sobem — o ouvinte do pai também é atendido", () => {
    const pai = document.createElement("div");
    const botao = document.createElement("button");
    pai.append(botao);
    document.body.append(pai);

    const noPai = vi.fn();
    pai.addEventListener("pointerdown", noPai);

    abrirGatilho(botao);

    expect(noPai).toHaveBeenCalled();
    pai.remove();
  });
});

describe("acharAlvo", () => {
  it("acha pelo atributo, e não confunde com outro valor", () => {
    const alvo = document.createElement("div");
    alvo.dataset.jornada = "produtos-busca";
    const outro = document.createElement("div");
    outro.dataset.jornada = "produtos-busca-avancada";
    document.body.append(alvo, outro);

    expect(acharAlvo("produtos-busca")).toBe(alvo);
    expect(acharAlvo("nao-existe")).toBeNull();

    alvo.remove();
    outro.remove();
  });
});

describe("containerDoAlvo", () => {
  it("alvo solto na página é desenhado no corpo", () => {
    const alvo = document.createElement("button");
    document.body.append(alvo);
    expect(containerDoAlvo(alvo)).toBe(document.body);
    alvo.remove();
  });

  it("alvo dentro de um diálogo é desenhado NO diálogo", () => {
    // Desenhado no corpo, o clique no balão contaria como clique fora e
    // fecharia o diálogo que o passo está ensinando.
    const dialogo = document.createElement("div");
    dialogo.setAttribute("role", "dialog");
    const alvo = document.createElement("button");
    dialogo.append(alvo);
    document.body.append(dialogo);

    expect(containerDoAlvo(alvo)).toBe(dialogo);
    dialogo.remove();
  });
});
