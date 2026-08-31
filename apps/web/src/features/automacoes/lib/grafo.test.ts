import { describe, expect, it } from "vitest";
import { avaliar } from "./condicao";
import { acharGatilho, type Grafo, proximos, validarGrafo } from "./grafo";

const no = (id: string, type: string, name = id) =>
  ({ id, type, name, data: {} }) as Grafo["nos"][number];

const aresta = (de: string, para: string, saida = "main") => ({
  fromNodeId: de,
  toNodeId: para,
  fromOutput: saida,
});

describe("caminhada pelo grafo", () => {
  const grafo: Grafo = {
    nos: [
      no("g", "TRIGGER_MESSAGE_IN"),
      no("f", "FILTER"),
      no("msg", "SEND_MESSAGE"),
      no("etapa", "MOVE_STAGE"),
    ],
    arestas: [
      aresta("g", "f"),
      aresta("f", "msg", "sim"),
      aresta("f", "etapa", "nao"),
    ],
  };

  it("acha o gatilho", () => {
    expect(acharGatilho(grafo)?.id).toBe("g");
  });

  it("o filtro manda para lados diferentes conforme a porta", () => {
    expect(proximos(grafo, "f", "sim").map((n) => n.id)).toEqual(["msg"]);
    expect(proximos(grafo, "f", "nao").map((n) => n.id)).toEqual(["etapa"]);
    // A porta padrão não pega nenhuma das duas — sair de um filtro pela
    // "main" seria executar os dois lados.
    expect(proximos(grafo, "f")).toEqual([]);
  });

  it("passo final não tem para onde ir", () => {
    expect(proximos(grafo, "msg")).toEqual([]);
  });
});

describe("validação antes de ativar", () => {
  it("aceita um grafo linear ligado", () => {
    const problemas = validarGrafo({
      nos: [no("g", "TRIGGER_NEW_LEAD"), no("a", "SEND_MESSAGE")],
      arestas: [aresta("g", "a")],
    });
    expect(problemas).toEqual([]);
  });

  it("recusa sem gatilho", () => {
    const problemas = validarGrafo({
      nos: [no("a", "SEND_MESSAGE")],
      arestas: [],
    });
    expect(problemas.map((p) => p.codigo)).toEqual(["SEM_GATILHO"]);
  });

  it("recusa dois gatilhos", () => {
    const problemas = validarGrafo({
      nos: [no("g1", "TRIGGER_NEW_LEAD"), no("g2", "TRIGGER_MESSAGE_IN")],
      arestas: [],
    });
    expect(problemas.map((p) => p.codigo)).toEqual(["MAIS_DE_UM_GATILHO"]);
  });

  it("avisa que o gatilho não leva a lugar nenhum", () => {
    const problemas = validarGrafo({
      nos: [no("g", "TRIGGER_NEW_LEAD")],
      arestas: [],
    });
    expect(problemas.map((p) => p.codigo)).toContain("GATILHO_SEM_SAIDA");
  });

  it("aponta o passo solto pelo nome, para o operador achar na tela", () => {
    const problemas = validarGrafo({
      nos: [
        no("g", "TRIGGER_NEW_LEAD"),
        no("a", "SEND_MESSAGE"),
        no("orfao", "MOVE_STAGE", "Mover para Proposta"),
      ],
      arestas: [aresta("g", "a")],
    });
    const solto = problemas.find((p) => p.codigo === "NO_SOLTO");
    expect(solto?.mensagem).toContain("Mover para Proposta");
    expect(solto?.nodeId).toBe("orfao");
  });

  it("recusa ciclo — seria mensagem repetida até o teto por hora", () => {
    const problemas = validarGrafo({
      nos: [
        no("g", "TRIGGER_MESSAGE_IN"),
        no("a", "SEND_MESSAGE"),
        no("b", "WAIT"),
      ],
      arestas: [aresta("g", "a"), aresta("a", "b"), aresta("b", "a")],
    });
    expect(problemas.map((p) => p.codigo)).toContain("CICLO");
  });

  it("recusa ligação para passo apagado", () => {
    const problemas = validarGrafo({
      nos: [no("g", "TRIGGER_NEW_LEAD")],
      arestas: [aresta("g", "sumiu")],
    });
    expect(problemas.map((p) => p.codigo)).toContain("ARESTA_QUEBRADA");
  });
});

describe("condição do filtro", () => {
  const contexto = {
    temperatura: "HOT" as const,
    stageId: "etapa-1",
    responsibleId: null,
    customerId: "cliente-9",
    textoDaMensagem: "Quero saber o PREÇO do produto",
    valor: 250,
  };

  it("compara sem diferenciar maiúscula", () => {
    expect(
      avaliar(
        { campo: "temperatura", operador: "igual", valor: "hot" },
        contexto,
      ),
    ).toBe(true);
  });

  it("contém acha o trecho em qualquer caixa", () => {
    expect(
      avaliar(
        { campo: "texto_da_mensagem", operador: "contem", valor: "preço" },
        contexto,
      ),
    ).toBe(true);
  });

  it("contém com valor vazio é falso, não verdadeiro para todos", () => {
    // O contrário é o filtro que parece ligado e deixa passar todo mundo.
    expect(
      avaliar(
        { campo: "texto_da_mensagem", operador: "contem", valor: "" },
        contexto,
      ),
    ).toBe(false);
  });

  it("existe distingue vazio de preenchido", () => {
    expect(avaliar({ campo: "cliente", operador: "existe" }, contexto)).toBe(
      true,
    );
    expect(
      avaliar({ campo: "responsavel", operador: "nao_existe" }, contexto),
    ).toBe(true);
  });

  it("compara número como número, não como texto", () => {
    // Como texto, "250" < "30" seria verdadeiro.
    expect(
      avaliar({ campo: "valor", operador: "maior_que", valor: "30" }, contexto),
    ).toBe(true);
    expect(
      avaliar({ campo: "valor", operador: "menor_que", valor: "30" }, contexto),
    ).toBe(false);
  });
});
