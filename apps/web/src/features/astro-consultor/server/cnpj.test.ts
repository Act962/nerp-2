import { describe, expect, it } from "vitest";
import { cnpjValido, lerRespostaDaApi, limparCnpj } from "./cnpj";

/**
 * Nada aqui toca a rede. O que importa travar é o que roda ANTES dela — a
 * validação, que existe para não gastar chamada de API pública com erro de
 * digitação — e o que roda DEPOIS: a leitura do corpo, que precisa sobreviver
 * a campo faltando sem derrubar a conversa.
 */

/** CNPJ público e real (Open Knowledge Brasil), o mesmo do exemplo da API. */
const REAL = "19131243000197";

describe("limparCnpj", () => {
  it("tira a máscara", () => {
    expect(limparCnpj("19.131.243/0001-97")).toBe(REAL);
  });

  it("mantém letra, porque o CNPJ alfanumérico existe desde 2026", () => {
    expect(limparCnpj("12.ABC.345/01DE-35")).toBe("12ABC34501DE35");
  });

  it("corta o que passa de catorze", () => {
    expect(limparCnpj("191312430001979999")).toBe(REAL);
  });
});

describe("cnpjValido", () => {
  it("aceita um CNPJ de verdade", () => {
    expect(cnpjValido(REAL)).toBe(true);
    expect(cnpjValido("19.131.243/0001-97")).toBe(true);
  });

  it("recusa dígito verificador trocado", () => {
    expect(cnpjValido("19131243000198")).toBe(false);
  });

  it("recusa o que nem tem catorze", () => {
    expect(cnpjValido("1913124300019")).toBe(false);
    expect(cnpjValido("")).toBe(false);
  });

  it("recusa a sequência de um dígito só, que fecha a conta por acidente", () => {
    expect(cnpjValido("00000000000000")).toBe(false);
  });

  it("valida o alfanumérico pela mesma regra", () => {
    // Exemplo da própria Receita para o novo formato.
    expect(cnpjValido("12ABC34501DE35")).toBe(true);
    expect(cnpjValido("12ABC34501DE34")).toBe(false);
  });
});

const CORPO = {
  cnpj: REAL,
  razao_social: "OPEN KNOWLEDGE BRASIL",
  nome_fantasia: "REDE PELO CONHECIMENTO LIVRE",
  cnae_fiscal_descricao:
    "Atividades de associações de defesa de direitos sociais",
  cnaes_secundarios: [
    { descricao: "Primeira" },
    { descricao: "Segunda" },
    { descricao: "Terceira" },
    { descricao: "Quarta" },
  ],
  natureza_juridica: "Associação Privada",
  porte: "DEMAIS",
  capital_social: 0,
  descricao_situacao_cadastral: "ATIVA",
  data_inicio_atividade: "2013-10-03",
  municipio: "SAO PAULO",
  uf: "SP",
  descricao_identificador_matriz_filial: "MATRIZ",
  qsa: [
    {
      nome_socio: "HAYDEE SVAB",
      qualificacao_socio: "Presidente",
      data_entrada_sociedade: "2024-02-27",
    },
  ],
};

describe("lerRespostaDaApi", () => {
  const AGORA = new Date("2026-09-05T12:00:00.000Z");

  it("monta a ficha", () => {
    const empresa = lerRespostaDaApi(CORPO, REAL, AGORA);
    expect(empresa?.razaoSocial).toBe("OPEN KNOWLEDGE BRASIL");
    expect(empresa?.atividadePrincipal).toContain("associações");
    expect(empresa?.porte).toBe("DEMAIS");
    expect(empresa?.municipio).toBe("SAO PAULO");
    expect(empresa?.matriz).toBe(true);
    expect(empresa?.socios).toEqual([
      {
        nome: "HAYDEE SVAB",
        qualificacao: "Presidente",
        desde: "2024-02-27",
      },
    ]);
  });

  it("conta os anos de casa, que é o que vira conversa", () => {
    expect(lerRespostaDaApi(CORPO, REAL, AGORA)?.anosDeCasa).toBe(12);
  });

  it("corta a cauda dos CNAEs secundários", () => {
    expect(lerRespostaDaApi(CORPO, REAL, AGORA)?.atividadesSecundarias).toEqual(
      ["Primeira", "Segunda", "Terceira"],
    );
  });

  // A base pública da Receita não tem quadro de pessoal. O campo existe nulo
  // para o modelo VER que o dado não existe — sem ele, "quantos funcionários?"
  // viraria estimativa inventada.
  it("diz explicitamente que não sabe o número de funcionários", () => {
    expect(lerRespostaDaApi(CORPO, REAL, AGORA)?.funcionarios).toBeNull();
  });

  it("aguenta corpo pela metade", () => {
    const empresa = lerRespostaDaApi(
      { razao_social: "MERCADO SANTA CLARA LTDA" },
      REAL,
      AGORA,
    );
    expect(empresa?.razaoSocial).toBe("MERCADO SANTA CLARA LTDA");
    expect(empresa?.socios).toEqual([]);
    expect(empresa?.anosDeCasa).toBeNull();
  });

  it("sem razão social não há ficha", () => {
    expect(lerRespostaDaApi({ uf: "CE" }, REAL, AGORA)).toBeNull();
    expect(lerRespostaDaApi(null, REAL, AGORA)).toBeNull();
  });
});
