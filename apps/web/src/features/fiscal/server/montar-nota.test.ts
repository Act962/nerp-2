import { calcularTotais, validarNotaParaEmissao } from "@nerp/fiscal";
import { describe, expect, it } from "vitest";
import {
  type ConfigEmitente,
  type VendaParaMontar,
  montarNotaDaVenda,
} from "./montar-nota";

const config: ConfigEmitente = {
  environment: "HOMOLOGACAO",
  cnpj: "11.222.333/0001-81",
  ie: "19.456.789-0",
  legalName: "MERCADINHO EXEMPLO LTDA",
  tradeName: "Mercadinho",
  taxRegime: "SIMPLES_NACIONAL",
  ufFiscal: "PI",
  cityCode: "2211001",
  cityName: "Teresina",
  address: "Av. Frei Serafim",
  addressNumber: "1000",
  complement: null,
  neighborhood: "Centro",
  zipCode: "64001-020",
  fiscalPhone: null,
  nfceSerie: 3,
  padroes: { cfop: "5102", cstIcms: "102", cstPis: "49", cstCofins: "49" },
};

const produto = (
  extra: Partial<VendaParaMontar["itens"][number]["produto"]> = {},
) => ({
  id: "prod-1",
  sku: "ARROZ",
  barcode: null,
  unit: "UN",
  ncm: "10063021",
  ...extra,
});

const venda = (extra: Partial<VendaParaMontar> = {}): VendaParaMontar => ({
  total: 30,
  shipping: 0,
  paymentMethod: "PIX",
  pagamentos: [{ method: "PIX", amount: 30 }],
  cliente: null,
  itens: [
    {
      productName: "Arroz 5kg",
      quantity: 1,
      unitPrice: 20,
      produto: produto(),
    },
    {
      productName: "Feijão 1kg",
      quantity: 2,
      unitPrice: 5,
      produto: produto({ id: "prod-2", sku: null }),
    },
  ],
  ...extra,
});

describe("montarNotaDaVenda", () => {
  it("monta uma NFC-e válida, completando com os padrões da empresa", () => {
    const r = montarNotaDaVenda(venda(), config, undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.serie).toBe(3);
    expect(validarNotaParaEmissao(r.nota)).toEqual([]);
    expect(r.nota.emitente).toMatchObject({
      cnpj: "11222333000181",
      inscricaoEstadual: "194567890",
    });
    expect(r.nota.emitente.endereco.cep).toBe("64001020");
    expect(r.nota.itens[0]).toMatchObject({
      codigo: "ARROZ",
      cfop: "5102",
      valorUnitario: 2000,
      desconto: 0,
    });
    // Sem SKU, o código do produto é o id.
    expect(r.nota.itens[1].codigo).toBe("prod-2");
  });

  it("o total da nota é o total da venda: desconto da venda é rateado nos itens", () => {
    const r = montarNotaDaVenda(
      venda({ total: 27, pagamentos: [{ method: "PIX", amount: 27 }] }),
      config,
      undefined,
    );
    expect(r.ok && r.nota.itens.map((i) => i.desconto)).toEqual([200, 100]);
    expect(r.ok && calcularTotais(r.nota).total).toBe(2700);
  });

  it("produto pesado: o arredondamento fecha no total cobrado", () => {
    const r = montarNotaDaVenda(
      venda({
        total: 30.12,
        pagamentos: [{ method: "DINHEIRO", amount: 30.12 }],
        itens: [
          {
            productName: "Queijo kg",
            quantity: 0.755,
            unitPrice: 39.9,
            produto: produto({ unit: "KG" }),
          },
        ],
      }),
      config,
      undefined,
    );
    expect(r.ok && calcularTotais(r.nota).total).toBe(3012);
    expect(r.ok && r.nota.itens[0].desconto).toBe(0);
  });

  it("GTIN só vai quando o código de barras é válido", () => {
    const r = montarNotaDaVenda(
      venda({
        itens: [
          {
            productName: "Refri",
            quantity: 1,
            unitPrice: 10,
            produto: produto({ barcode: "4006381333931" }),
          },
          {
            productName: "Pão",
            quantity: 1,
            unitPrice: 20,
            produto: produto({ barcode: "2000123" }),
          },
        ],
      }),
      config,
      undefined,
    );
    expect(r.ok && r.nota.itens.map((i) => i.gtin)).toEqual([
      "4006381333931",
      null,
    ]);
  });

  it("CPF na nota: o informado vence; sem informar, usa o cliente com documento válido", () => {
    const comCliente = venda({
      cliente: { name: "Ana", document: "529.982.247-25" },
    });
    const padrao = montarNotaDaVenda(comCliente, config, undefined);
    expect(padrao.ok && padrao.nota.destinatario).toEqual({
      documento: "52998224725",
      nome: "Ana",
    });
    const semCpf = montarNotaDaVenda(comCliente, config, null);
    expect(semCpf.ok && semCpf.nota.destinatario).toBeNull();
    const clienteInvalido = montarNotaDaVenda(
      venda({ cliente: { name: "B", document: "123" } }),
      config,
      undefined,
    );
    expect(clienteInvalido.ok && clienteInvalido.nota.destinatario).toBeNull();
  });

  it("lista o que falta em cada produto, com o nome dele", () => {
    const r = montarNotaDaVenda(
      venda({
        itens: [
          {
            productName: "Sem NCM",
            quantity: 1,
            unitPrice: 30,
            produto: produto({ ncm: null }),
          },
        ],
      }),
      config,
      undefined,
    );
    expect(r).toEqual({
      ok: false,
      pendencias: [
        { campo: "itens[0].ncm", mensagem: "Sem NCM: Sem NCM", itemIndice: 0 },
      ],
    });
  });

  it("barra o que ainda não emitimos: sem config, Regime Normal e frete", () => {
    expect(montarNotaDaVenda(venda(), null, undefined).ok).toBe(false);
    expect(
      montarNotaDaVenda(
        venda(),
        { ...config, taxRegime: "LUCRO_PRESUMIDO" },
        undefined,
      ),
    ).toMatchObject({
      ok: false,
      pendencias: [{ campo: "emitente.regime" }],
    });
    expect(
      montarNotaDaVenda(venda({ shipping: 5 }), config, undefined),
    ).toMatchObject({
      ok: false,
      pendencias: [{ campo: "frete" }],
    });
  });

  it("sem pagamentos registrados, usa a forma da venda pelo total", () => {
    const r = montarNotaDaVenda(
      venda({ pagamentos: [], paymentMethod: "DEBITO" }),
      config,
      undefined,
    );
    expect(r.ok && r.nota.pagamentos).toEqual([
      { forma: "DEBITO", valor: 3000 },
    ]);
  });
});
