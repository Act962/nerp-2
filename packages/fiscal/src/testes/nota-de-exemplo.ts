import type { NotaFiscal } from "../dominio/nota-fiscal";

/**
 * Uma NFC-e válida de um mercadinho do Simples Nacional em Teresina: um
 * refrigerante com ICMS por substituição tributária (CFOP 5405 / CSOSN 500) e
 * um arroz tributado normalmente no Simples (5102 / 102). Base para testes e
 * para o teste de contrato contra a homologação de um provedor real.
 */
export function notaDeExemplo(
  sobrescrever: Partial<NotaFiscal> = {},
): NotaFiscal {
  return {
    modelo: 65,
    ambiente: "HOMOLOGACAO",
    emitente: {
      cnpj: "11222333000181",
      inscricaoEstadual: "194567890",
      razaoSocial: "MERCADINHO EXEMPLO LTDA",
      nomeFantasia: "Mercadinho Exemplo",
      regime: "SIMPLES_NACIONAL",
      endereco: {
        logradouro: "Avenida Frei Serafim",
        numero: "1000",
        bairro: "Centro",
        codigoMunicipio: "2211001",
        municipio: "Teresina",
        uf: "PI",
        cep: "64001020",
      },
    },
    destinatario: null,
    itens: [
      {
        codigo: "REFRI-2L",
        descricao: "REFRIGERANTE COLA 2L",
        gtin: "4006381333931",
        ncm: "22021000",
        cest: "0300700",
        cfop: "5405",
        unidade: "UN",
        quantidade: 2,
        valorUnitario: 899,
        desconto: 0,
        tributacao: {
          origem: "0",
          icms: { regime: "SIMPLES", csosn: "500" },
          pis: { cst: "49" },
          cofins: { cst: "49" },
        },
      },
      {
        codigo: "ARROZ-5KG",
        descricao: "ARROZ TIPO 1 5KG",
        gtin: null,
        ncm: "10063021",
        cfop: "5102",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 2490,
        desconto: 100,
        tributacao: {
          origem: "0",
          icms: { regime: "SIMPLES", csosn: "102" },
          pis: { cst: "49" },
          cofins: { cst: "49" },
        },
      },
    ],
    // 2 × 8,99 + 24,90 − 1,00 = 41,88
    pagamentos: [{ forma: "PIX", valor: 4188 }],
    ...sobrescrever,
  };
}
