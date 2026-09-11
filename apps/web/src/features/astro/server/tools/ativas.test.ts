import { describe, expect, it } from "vitest";
import {
  escolherFerramentas,
  FERRAMENTAS_DE_ESCRITA,
  FERRAMENTAS_DO_SITE,
  historicoTemEscrita,
} from "./ativas";

/**
 * Economia com um risco nomeado: ferramenta que falta é o modelo dizendo que
 * fez algo que não fez, porque não havia o que parar no cartão. Por isso a
 * regra da escrita é generosa, e a leitura da operação nunca sai.
 */

const LEITURA = [
  "minhaOperacao",
  "resumoDeVendas",
  "estoqueBaixo",
  "topClientes",
];
const DISPONIVEIS = [
  ...LEITURA,
  ...FERRAMENTAS_DE_ESCRITA,
  ...FERRAMENTAS_DO_SITE,
];

function ativas(texto: string, temEscritaNoHistorico = false) {
  return escolherFerramentas({
    disponiveis: DISPONIVEIS,
    texto,
    temEscritaNoHistorico,
  }).ativas;
}

describe("escolherFerramentas", () => {
  it("leitura da operação nunca sai", () => {
    for (const texto of ["quanto vendi hoje", "cria um catalogo", "oi"]) {
      for (const tool of LEITURA) {
        expect(ativas(texto), `${texto} → ${tool}`).toContain(tool);
      }
    }
  });

  it("pergunta comum não carrega escrita nem catálogo da ÓRBITA", () => {
    const escolhidas = ativas("quantos produtos eu tenho");
    expect(escolhidas).not.toContain("criarCatalogoPromocional");
    expect(escolhidas).not.toContain("estimarFaixaDePreco");
    expect(escolhidas.length).toBe(LEITURA.length);
  });

  it("verbo de ação liga a escrita", () => {
    for (const texto of [
      "cria um catalogo com as promocoes",
      "monte uma campanha para os inativos",
      "gere uma imagem de fundo",
      "agenda uma reuniao amanha",
      "lembra que a reposicao e na terca",
      "abre um chamado com o suporte",
    ]) {
      expect(ativas(texto), texto).toContain("criarCatalogoPromocional");
    }
  });

  it("assunto de contratação liga as do site", () => {
    expect(ativas("quanto custa o modulo de trade")).toContain(
      "estimarFaixaDePreco",
    );
    expect(ativas("quais ferramentas voces tem")).toContain(
      "buscarFerramentas",
    );
  });

  it("escrita no histórico mantém a escrita ligada", () => {
    // É como o laço de aprovação termina: a tool precisa existir para ser
    // executada quando o sim chega.
    expect(ativas("pode sim", true)).toContain("criarCatalogoPromocional");
    expect(ativas("pode sim", false)).not.toContain("criarCatalogoPromocional");
  });

  it("nunca ativa nome que não foi montado", () => {
    const escolhidas = escolherFerramentas({
      disponiveis: ["minhaOperacao"],
      texto: "cria um catalogo",
    }).ativas;
    expect(escolhidas).toEqual(["minhaOperacao"]);
  });
});

describe("historicoTemEscrita", () => {
  it("acha a chamada de escrita no histórico", () => {
    expect(
      historicoTemEscrita([
        { parts: [{ type: "text", text: "oi" }] },
        { parts: [{ type: "tool-criarCatalogoPromocional", state: "x" }] },
      ]),
    ).toBe(true);
  });

  it("ferramenta de leitura não conta", () => {
    expect(
      historicoTemEscrita([
        { parts: [{ type: "tool-resumoDeVendas", state: "output-available" }] },
      ]),
    ).toBe(false);
  });

  it("aguenta corpo malformado", () => {
    expect(historicoTemEscrita([{ sem: "parts" }, null, "isto"])).toBe(false);
  });
});
