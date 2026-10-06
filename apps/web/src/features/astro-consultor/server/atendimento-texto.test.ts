import { describe, expect, it } from "vitest";
import {
  cortar,
  LIMITE_DO_CHAT,
  lerMensagens,
  montarPedido,
} from "./atendimento-texto";

describe("montarPedido", () => {
  it("abre dizendo o que é e leva só o que foi informado", () => {
    const pedido = montarPedido({
      nome: "  Ana  Paula ",
      motivo: "quer falar sobre implantação",
      pagina: "https://www.orbitatec.com.br/solucoes/chat",
    });

    expect(pedido.split("\n")).toEqual([
      "Pedido de atendimento humano pelo Astro do site.",
      "Nome: Ana Paula",
      "Página: https://www.orbitatec.com.br/solucoes/chat",
      "Motivo: quer falar sobre implantação",
    ]);
  });

  it("sem dado nenhum, ainda é uma mensagem válida", () => {
    expect(montarPedido({})).toBe(
      "Pedido de atendimento humano pelo Astro do site.",
    );
  });

  it("nunca passa do teto do Chat", () => {
    const pedido = montarPedido({ resumo: "a".repeat(5000) });
    expect(pedido.length).toBe(LIMITE_DO_CHAT);
    expect(pedido.endsWith("…")).toBe(true);
  });
});

describe("cortar", () => {
  it("não mexe no que cabe", () => {
    expect(cortar("  oi  ")).toBe("oi");
  });
});

describe("lerMensagens", () => {
  const mensagem = (
    id: string,
    author: "visitor" | "astro" | "team",
    body = "oi",
  ) => ({
    id,
    body,
    author,
    senderName: author === "team" ? "Carla" : null,
    createdAt: "2026-10-06T12:00:00.000Z",
  });

  it("devolve só o que não é do visitante, mas o cursor anda sobre tudo", () => {
    const lido = lerMensagens({
      items: [
        mensagem("m1", "team", "Olá, sou a Carla"),
        mensagem("m2", "visitor", "oi Carla"),
      ],
    });

    expect(lido.respostas).toEqual([
      {
        id: "m1",
        texto: "Olá, sou a Carla",
        autor: "equipe",
        nome: "Carla",
        em: "2026-10-06T12:00:00.000Z",
      },
    ]);
    expect(lido.cursor).toBe("m2");
  });

  it("o aviso automático do Chat chega como do astro", () => {
    const lido = lerMensagens({ items: [mensagem("m1", "astro")] });
    expect(lido.respostas[0]?.autor).toBe("astro");
  });

  it("descarta item fora do formato em vez de quebrar", () => {
    const lido = lerMensagens({
      items: [{ id: 1 }, null, mensagem("m9", "team")],
    });
    expect(lido.respostas.map((r) => r.id)).toEqual(["m9"]);
    expect(lido.cursor).toBe("m9");
  });

  it("resposta vazia ou estranha não tem respostas nem cursor", () => {
    expect(lerMensagens(null)).toEqual({ respostas: [], cursor: null });
    expect(lerMensagens({ items: "x" })).toEqual({
      respostas: [],
      cursor: null,
    });
  });
});
