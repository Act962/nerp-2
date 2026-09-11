import { describe, expect, it } from "vitest";
import { escolherNivel } from "./dificuldade";

/**
 * O roteador decide quanto cada mensagem custa. Sem teste, em dois meses vira
 * um `if` que ninguém sabe explicar — e o sintoma de um erro aqui não é falha,
 * é resposta pior ou fatura maior, que ninguém liga ao commit.
 */

const base = {
  texto: "",
  temAnexo: false,
  temAcaoNoHistorico: false,
  mensagens: 1,
};

describe("o que exige o modelo forte", () => {
  it("imagem anexada — visão fraca lê rótulo errado", () => {
    expect(
      escolherNivel({ ...base, texto: "o que é isso?", temAnexo: true }),
    ).toEqual({ nivel: "pesado", motivo: "anexo" });
  });

  it("pedido de ação, porque tem consequência no mundo", () => {
    for (const texto of [
      "cria um catálogo com as promoções de café",
      "dispara a campanha para os inativos",
      "agenda uma reunião na quinta",
      "adiciona essa imagem no produto",
    ]) {
      expect(escolherNivel({ ...base, texto }).nivel, texto).toBe("pesado");
    }
  });

  it("aprovação pendente no histórico mantém o forte", () => {
    // O laço de aprovação precisa terminar com a mesma cabeça que começou.
    expect(
      escolherNivel({ ...base, texto: "pode sim", temAcaoNoHistorico: true }),
    ).toEqual({ nivel: "pesado", motivo: "acao" });
  });

  it("pedido de raciocínio: causa, comparação, projeção, recomendação", () => {
    for (const texto of [
      "por que vendi menos essa semana?",
      "compara meu ticket com o mês passado",
      "qual a previsão de vendas pros próximos 15 dias",
      "o que você recomenda pra girar o estoque parado",
      "vale a pena fazer promoção de café agora?",
    ]) {
      expect(escolherNivel({ ...base, texto }).nivel, texto).toBe("pesado");
    }
  });
});

describe("o que cabe no modelo leve", () => {
  it("pergunta curta e fechada", () => {
    for (const texto of [
      "quantos clientes eu tenho",
      "qual meu saldo de stars",
      "quando é a próxima ação do calendário",
    ]) {
      expect(escolherNivel({ ...base, texto }).nivel, texto).toBe("leve");
    }
  });

  it("pergunta fechada mas LONGA não é leve", () => {
    const texto =
      "qual foi o produto que mais vendeu considerando as lojas da capital e do interior separando por categoria";
    expect(escolherNivel({ ...base, texto }).nivel).toBe("medio");
  });
});

describe("quando não dá para saber", () => {
  it("o padrão é o MÉDIO, e não o leve", () => {
    // Errar para baixo aparece como resposta errada; errar para cima aparece
    // como centavos. Na dúvida, pagam-se os centavos.
    expect(escolherNivel({ ...base, texto: "oi, tudo bem?" })).toEqual({
      nivel: "medio",
      motivo: "padrao",
    });
    expect(escolherNivel({ ...base, texto: "" }).nivel).toBe("medio");
  });

  it("conversa longa sobe para o médio mesmo com pergunta curta", () => {
    expect(
      escolherNivel({ ...base, texto: "quantos produtos", mensagens: 20 }),
    ).toEqual({ nivel: "medio", motivo: "conversa-longa" });
  });
});

describe("a ordem das regras", () => {
  it("anexo ganha de tudo", () => {
    expect(
      escolherNivel({
        ...base,
        texto: "quantos produtos",
        temAnexo: true,
        mensagens: 30,
      }).motivo,
    ).toBe("anexo");
  });

  it("ação ganha de raciocínio", () => {
    expect(
      escolherNivel({ ...base, texto: "cria um catálogo e me explica por que" })
        .motivo,
    ).toBe("acao");
  });

  it("acento não muda a decisão", () => {
    expect(escolherNivel({ ...base, texto: "por que vendi menos" }).nivel).toBe(
      "pesado",
    );
    expect(escolherNivel({ ...base, texto: "porque vendi menos" }).nivel).toBe(
      "pesado",
    );
  });
});
