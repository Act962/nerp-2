import { notaDeExemplo } from "@nerp/fiscal/testes";
import { describe, expect, it } from "vitest";
import {
  DESCRICAO_HOMOLOGACAO,
  lerProtocoloDoXml,
  paraPedidoFocus,
  situacaoDaFocus,
} from "./mapeador";

const solicitacao = (nota = notaDeExemplo()) => ({
  ref: "doc-1",
  serie: 1,
  numero: 42,
  emitidaEm: new Date("2026-11-03T13:00:00.000Z"),
  nota,
});

describe("mapeador Focus", () => {
  it("monta o cabeçalho da NFC-e presencial", () => {
    const p = paraPedidoFocus(solicitacao());
    expect(p).toMatchObject({
      cnpj_emitente: "11222333000181",
      data_emissao: "2026-11-03T10:00:00-03:00",
      natureza_operacao: "VENDA AO CONSUMIDOR",
      presenca_comprador: "1",
      modalidade_frete: "9",
      local_destino: "1",
      indicador_inscricao_estadual_destinatario: "9",
      serie: "1",
      numero: "42",
    });
    expect(p).not.toHaveProperty("cpf_destinatario");
  });

  it("em homologação o primeiro item leva o texto exigido pela SEFAZ", () => {
    const p = paraPedidoFocus(solicitacao());
    expect(p.items[0].descricao).toBe(DESCRICAO_HOMOLOGACAO);
    expect(p.items[1].descricao).toBe("ARROZ TIPO 1 5KG");

    const producao = paraPedidoFocus(
      solicitacao(notaDeExemplo({ ambiente: "PRODUCAO" })),
    );
    expect(producao.items[0].descricao).toBe("REFRIGERANTE COLA 2L");
  });

  it("itens em reais, com GTIN, SEM GTIN, desconto e tributação do Simples", () => {
    const [refri, arroz] = paraPedidoFocus(solicitacao()).items;
    expect(refri).toMatchObject({
      numero_item: "1",
      codigo_ncm: "22021000",
      cest: "0300700",
      cfop: "5405",
      quantidade_comercial: 2,
      valor_unitario_comercial: 8.99,
      valor_bruto: 17.98,
      codigo_barras_comercial: "4006381333931",
      icms_origem: "0",
      icms_situacao_tributaria: "500",
      pis_situacao_tributaria: "49",
      cofins_situacao_tributaria: "49",
    });
    expect(refri).not.toHaveProperty("valor_desconto");
    expect(arroz).toMatchObject({
      codigo_barras_comercial: "SEM GTIN",
      codigo_barras_tributavel: "SEM GTIN",
      valor_desconto: 1,
      icms_situacao_tributaria: "102",
    });
    expect(arroz).not.toHaveProperty("cest");
  });

  it("pagamento: código tPag, cartão não integrado e troco", () => {
    const p = paraPedidoFocus(
      solicitacao(
        notaDeExemplo({
          pagamentos: [
            { forma: "CREDITO", valor: 2000 },
            { forma: "DINHEIRO", valor: 3000 },
          ],
        }),
      ),
    );
    expect(p.formas_pagamento).toEqual([
      { forma_pagamento: "03", valor_pagamento: 20, tipo_integracao: "2" },
      { forma_pagamento: "01", valor_pagamento: 30 },
    ]);
    // 50,00 pagos − 41,88 = 8,12
    expect(p.valor_troco).toBe(8.12);
  });

  it("CPF ou CNPJ do consumidor vão no campo certo", () => {
    expect(
      paraPedidoFocus(
        solicitacao(
          notaDeExemplo({
            destinatario: { documento: "529.982.247-25", nome: "Ana" },
          }),
        ),
      ),
    ).toMatchObject({
      cpf_destinatario: "52998224725",
      nome_destinatario: "Ana",
    });
    expect(
      paraPedidoFocus(
        solicitacao(
          notaDeExemplo({ destinatario: { documento: "11222333000181" } }),
        ),
      ),
    ).toMatchObject({ cnpj_destinatario: "11222333000181" });
  });

  it("lê protocolo e data do XML autorizado", () => {
    expect(
      lerProtocoloDoXml(
        "<protNFe><dhRecbto>2026-11-03T10:00:01-03:00</dhRecbto><nProt>222260000000001</nProt></protNFe>",
      ),
    ).toEqual({
      protocolo: "222260000000001",
      autorizadaEm: new Date("2026-11-03T13:00:01.000Z"),
    });
    expect(lerProtocoloDoXml("<x/>")).toEqual({
      protocolo: null,
      autorizadaEm: null,
    });
  });

  it("traduz os status da Focus", () => {
    expect(situacaoDaFocus({ status: "autorizado" })).toEqual({
      tipo: "AUTORIZADA",
    });
    expect(situacaoDaFocus({ status: "processando_autorizacao" })).toEqual({
      tipo: "PROCESSANDO",
    });
    expect(
      situacaoDaFocus({
        status: "erro_autorizacao",
        status_sefaz: "704",
        mensagem_sefaz: "Rejeição: atrasada",
      }),
    ).toEqual({
      situacao: "REJEITADA",
      codigo: "704",
      motivo: "Rejeição: atrasada",
    });
    expect(
      situacaoDaFocus({ status: "denegado", status_sefaz: "301" }),
    ).toMatchObject({ situacao: "DENEGADA" });
  });
});
