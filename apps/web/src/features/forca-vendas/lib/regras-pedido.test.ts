import { describe, expect, it } from "vitest";
import {
  flexDoPedido,
  motivosDeAprovacao,
  type PoliticaComercial,
  type SituacaoDoCliente,
  statusInicial,
  totalDoPedido,
} from "./regras-pedido";

// Tabela de R$ 7,89, desconto livre de 3% (piso R$ 7,65) e crédito de 50% do
// sobrepreço — o mesmo exemplo da página de apresentação.
const politica: PoliticaComercial = {
  descontoLivrePercent: 3,
  descontoMaximoPercent: 10,
  flexCreditoPercent: 50,
  flexLimiteNegativo: 0,
};

const clienteEmDia: SituacaoDoCliente = {
  bloqueado: false,
  vencido: 0,
  limiteCredito: null,
  exposicao: 0,
};

describe("flexDoPedido", () => {
  it("credita metade do sobrepreço", () => {
    const flex = flexDoPedido(
      "VENDA",
      [{ precoTabela: 7.89, precoUnitario: 7.99, quantidade: 800 }],
      politica,
    );
    expect(flex).toBe(40);
  });

  it("debita o que passa do desconto livre", () => {
    const flex = flexDoPedido(
      "VENDA",
      [{ precoTabela: 7.89, precoUnitario: 7.55, quantidade: 600 }],
      politica,
    );
    // Piso livre = 7,89 × 0,97 = 7,6533 → (7,6533 − 7,55) × 600.
    expect(flex).toBeCloseTo(-61.98, 2);
  });

  it("desconto dentro do livre não mexe no flex", () => {
    const flex = flexDoPedido(
      "VENDA",
      [{ precoTabela: 7.89, precoUnitario: 7.7, quantidade: 100 }],
      politica,
    );
    expect(flex).toBe(0);
  });

  it("bonificação não movimenta o flex", () => {
    const flex = flexDoPedido(
      "BONIFICACAO",
      [{ precoTabela: 7.89, precoUnitario: 0, quantidade: 20 }],
      politica,
    );
    expect(flex).toBe(0);
  });
});

describe("motivosDeAprovacao", () => {
  const base = {
    tipo: "VENDA" as const,
    politica,
    cliente: clienteEmDia,
    saldoFlexPrevisto: 1000,
    bloquearInadimplente: true,
  };

  it("pedido dentro da política não tem motivo", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      itens: [{ precoTabela: 10, precoUnitario: 9.5, quantidade: 10 }],
    });
    expect(motivos).toEqual([]);
  });

  it("desconto exatamente no máximo passa", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      itens: [{ precoTabela: 10, precoUnitario: 9, quantidade: 1 }],
    });
    expect(motivos).not.toContain("DESCONTO");
  });

  it("desconto acima do máximo vai para aprovação", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      itens: [{ precoTabela: 10, precoUnitario: 8.5, quantidade: 1 }],
    });
    expect(motivos).toContain("DESCONTO");
  });

  it("estourar o limite de crédito contando a exposição", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      cliente: { ...clienteEmDia, limiteCredito: 1000, exposicao: 900 },
      itens: [{ precoTabela: 10, precoUnitario: 10, quantidade: 20 }],
    });
    expect(motivos).toContain("LIMITE_CREDITO");
  });

  it("vencido e bloqueado aparecem juntos", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      cliente: { ...clienteEmDia, bloqueado: true, vencido: 120 },
      itens: [{ precoTabela: 10, precoUnitario: 10, quantidade: 1 }],
    });
    expect(motivos).toEqual(["CLIENTE_BLOQUEADO", "INADIMPLENTE"]);
  });

  it("vencido não segura o pedido quando a empresa desliga a regra", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      bloquearInadimplente: false,
      cliente: { ...clienteEmDia, vencido: 120 },
      itens: [{ precoTabela: 10, precoUnitario: 10, quantidade: 1 }],
    });
    expect(motivos).toEqual([]);
  });

  it("flex abaixo do limite negativo vai para aprovação", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      saldoFlexPrevisto: 10,
      itens: [{ precoTabela: 10, precoUnitario: 9.2, quantidade: 100 }],
    });
    expect(motivos).toContain("FLEX_NEGATIVO");
  });

  it("orçamento nunca pede aprovação", () => {
    const motivos = motivosDeAprovacao({
      ...base,
      tipo: "ORCAMENTO",
      cliente: { ...clienteEmDia, bloqueado: true },
      itens: [{ precoTabela: 10, precoUnitario: 1, quantidade: 1 }],
    });
    expect(motivos).toEqual([]);
  });
});

describe("statusInicial e total", () => {
  it("sem motivo e com autoaprovação entra confirmado", () => {
    expect(statusInicial("VENDA", [], true)).toBe("CONFIRMED");
    expect(statusInicial("VENDA", [], false)).toBe("PENDING_APPROVAL");
    expect(statusInicial("VENDA", ["DESCONTO"], true)).toBe("PENDING_APPROVAL");
    expect(statusInicial("ORCAMENTO", [], true)).toBe("DRAFT");
  });

  it("bonificação tem total zero", () => {
    expect(
      totalDoPedido("BONIFICACAO", [
        { precoTabela: 10, precoUnitario: 10, quantidade: 3 },
      ]),
    ).toBe(0);
  });
});
