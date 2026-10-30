import {
  type Ambiente,
  type CadastroFiscalProduto,
  type Destinatario,
  type FormaPagamento,
  type ItemNota,
  type NotaFiscal,
  type PadroesFiscais,
  type Pagamento,
  type Pendencia,
  type RegimeTributario,
  documentoValido,
  gtinValido,
  isUf,
  paraCentavos,
  ratearDesconto,
  resolverTributacao,
  somenteDigitos,
  tributosPeloPercentual,
  usaCsosn,
} from "@nerp/fiscal";

/**
 * Venda do ERP → `NotaFiscal`. Função pura: quem lê o banco é
 * `MontadorDeNotaPrisma`; aqui ficam as regras de tradução, testáveis sem
 * Postgres.
 *
 * Decisão central: o total da nota é o `Sale.total`. O desconto da nota é o
 * que falta para os itens brutos chegarem nele, rateado entre os itens. Isso
 * absorve, num cálculo só, desconto por item, desconto na venda e o
 * arredondamento de produto pesado — e o cupom fiscal fecha no centavo com o
 * que o cliente pagou.
 */

export type ConfigEmitente = {
  environment: Ambiente;
  cnpj: string | null;
  ie: string | null;
  legalName: string | null;
  tradeName: string | null;
  taxRegime: RegimeTributario | null;
  ufFiscal: string;
  cityCode: string | null;
  cityName: string | null;
  address: string | null;
  addressNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  fiscalPhone: string | null;
  nfceSerie: number | null;
  padroes: PadroesFiscais;
  /** Lei 12.741/2012; `null` = não informado, o item sai sem `vTotTrib`. */
  percentualTributos: number | null;
};

export type VendaParaMontar = {
  total: number;
  shipping: number;
  paymentMethod: FormaPagamento | null;
  pagamentos: { method: FormaPagamento; amount: number }[];
  cliente: { name: string; document: string | null } | null;
  itens: {
    productName: string;
    quantity: number;
    unitPrice: number;
    produto: CadastroFiscalProduto & {
      id: string;
      sku: string | null;
      barcode: string | null;
      unit: string;
    };
  }[];
};

export type ResultadoMontagem =
  | { ok: true; nota: NotaFiscal; serie: number }
  | { ok: false; pendencias: Pendencia[] };

export function montarNotaDaVenda(
  venda: VendaParaMontar,
  config: ConfigEmitente | null,
  destinatarioInformado: Destinatario | null | undefined,
): ResultadoMontagem {
  if (!config?.taxRegime)
    return {
      ok: false,
      pendencias: [
        {
          campo: "emitente",
          mensagem:
            "Configure os dados fiscais e o regime tributário da empresa (Integrações → Focus NFe)",
        },
      ],
    };
  const regime = config.taxRegime;
  // Regime Normal pede base de cálculo e alíquota de ICMS por item, que ainda
  // não calculamos. Barrar aqui evita mandar nota que a SEFAZ vai recusar.
  if (!usaCsosn(regime))
    return {
      ok: false,
      pendencias: [
        {
          campo: "emitente.regime",
          mensagem:
            "Emissão para Lucro Presumido/Real ainda não está disponível — por enquanto só Simples Nacional e MEI",
        },
      ],
    };
  if (venda.shipping > 0)
    return {
      ok: false,
      pendencias: [
        {
          campo: "frete",
          mensagem: "Venda com frete ainda não sai em NFC-e",
        },
      ],
    };

  const pendencias: Pendencia[] = [];
  const brutos = venda.itens.map((i) =>
    Math.round(i.quantity * paraCentavos(i.unitPrice)),
  );
  const total = paraCentavos(venda.total);
  const desconto = brutos.reduce((s, v) => s + v, 0) - total;
  if (desconto < 0)
    pendencias.push({
      campo: "total",
      mensagem: "O total da venda é maior que a soma dos itens",
    });
  const descontos = ratearDesconto(brutos, Math.max(0, desconto));

  const itens: ItemNota[] = [];
  venda.itens.forEach((item, i) => {
    const r = resolverTributacao(item.produto, config.padroes, regime);
    if (!r.ok) {
      for (const p of r.pendencias)
        pendencias.push({
          campo: `itens[${i}].${p.campo}`,
          mensagem: `${item.productName}: ${p.mensagem}`,
          itemIndice: i,
        });
      return;
    }
    const barcode = item.produto.barcode?.trim() || null;
    itens.push({
      codigo: item.produto.sku?.trim() || item.produto.id,
      descricao: item.productName.slice(0, 120),
      gtin: barcode && gtinValido(barcode) ? barcode : null,
      ncm: r.valor.ncm,
      cest: r.valor.cest,
      cfop: r.valor.cfop,
      unidade: item.produto.unit,
      quantidade: item.quantity,
      valorUnitario: paraCentavos(item.unitPrice),
      desconto: descontos[i],
      tributacao: r.valor.tributacao,
      tributosAproximados:
        config.percentualTributos != null
          ? tributosPeloPercentual(
              brutos[i] - descontos[i],
              config.percentualTributos,
            )
          : null,
    });
  });
  if (pendencias.length > 0) return { ok: false, pendencias };

  const pagamentos: Pagamento[] =
    venda.pagamentos.length > 0
      ? venda.pagamentos.map((p) => ({
          forma: p.method,
          valor: paraCentavos(p.amount),
        }))
      : [{ forma: venda.paymentMethod ?? "OUTROS", valor: total }];

  return {
    ok: true,
    serie: config.nfceSerie ?? 1,
    nota: {
      modelo: 65,
      ambiente: config.environment,
      emitente: {
        cnpj: somenteDigitos(config.cnpj ?? ""),
        inscricaoEstadual: somenteDigitos(config.ie ?? ""),
        razaoSocial: config.legalName ?? "",
        nomeFantasia: config.tradeName,
        regime,
        endereco: {
          logradouro: config.address ?? "",
          numero: config.addressNumber ?? "",
          complemento: config.complement,
          bairro: config.neighborhood ?? "",
          codigoMunicipio: config.cityCode ?? "",
          municipio: config.cityName ?? "",
          uf: isUf(config.ufFiscal) ? config.ufFiscal : "PI",
          cep: somenteDigitos(config.zipCode ?? ""),
          telefone: config.fiscalPhone,
        },
      },
      destinatario:
        destinatarioInformado !== undefined
          ? destinatarioInformado
          : destinatarioDoCliente(venda.cliente),
      itens,
      pagamentos,
    },
  };
}

// Cliente vinculado com CPF/CNPJ válido vira o "CPF na nota" por padrão.
function destinatarioDoCliente(
  cliente: VendaParaMontar["cliente"],
): Destinatario | null {
  if (!cliente?.document || !documentoValido(cliente.document)) return null;
  return { documento: somenteDigitos(cliente.document), nome: cliente.name };
}
