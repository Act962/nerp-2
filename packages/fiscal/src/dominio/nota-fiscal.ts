import type { ModeloDocumento } from "../core/chave";
import type { Uf } from "../uf/uf";

/**
 * O CONTEÚDO de uma nota: quem vende, para quem, o quê, com que tributos e
 * como foi pago. É o que qualquer provedor (ou o emissor próprio do desktop)
 * recebe — e por isso não tem nada de Focus, de Prisma ou de XML aqui.
 *
 * Valores em CENTAVOS (inteiros). Float acumula erro na soma dos itens, e a
 * SEFAZ rejeita a nota cujo total diverge da soma por um centavo (rejeição
 * 610 / 564).
 */

export type Centavos = number;

export type Ambiente = "HOMOLOGACAO" | "PRODUCAO";

/** Espelha o enum `TaxRegime` do banco. */
export type RegimeTributario =
  | "SIMPLES_NACIONAL"
  | "SIMPLES_MEI"
  | "LUCRO_PRESUMIDO"
  | "LUCRO_REAL";

/** CRT da nota: 1 = Simples, 3 = Regime Normal, 4 = MEI. */
export function crtDoRegime(regime: RegimeTributario): 1 | 3 | 4 {
  if (regime === "SIMPLES_NACIONAL") return 1;
  if (regime === "SIMPLES_MEI") return 4;
  return 3;
}

/** Simples e MEI usam CSOSN; Regime Normal usa CST. */
export function usaCsosn(regime: RegimeTributario): boolean {
  return crtDoRegime(regime) !== 3;
}

export type Endereco = {
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  /** Código IBGE do município, 7 dígitos (Teresina = 2211001). */
  codigoMunicipio: string;
  municipio: string;
  uf: Uf;
  cep: string;
  telefone?: string | null;
};

export type Emitente = {
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  regime: RegimeTributario;
  endereco: Endereco;
};

/** Na NFC-e o destinatário é opcional: o "CPF na nota". */
export type Destinatario = {
  /** CPF ou CNPJ, só dígitos. */
  documento: string;
  nome?: string | null;
};

export type IcmsItem =
  | { regime: "SIMPLES"; csosn: string }
  | { regime: "NORMAL"; cst: string; aliquota?: number | null };

/** Grupo da reforma (NT 2025.002). Opcional até o cronograma exigir. */
export type IbsCbsItem = { cst: string; cClassTrib: string };

export type TributacaoItem = {
  /** 0 = nacional, 1/2 = estrangeira… (tabela de origem da mercadoria). */
  origem: string;
  icms: IcmsItem;
  pis: { cst: string };
  cofins: { cst: string };
  ibsCbs?: IbsCbsItem | null;
};

export type ItemNota = {
  /** Código interno (SKU/id) — vai como `cProd`. */
  codigo: string;
  descricao: string;
  /** EAN; `null` vira "SEM GTIN" no XML. */
  gtin?: string | null;
  ncm: string;
  cest?: string | null;
  cfop: string;
  unidade: string;
  /** Pode ser fracionada (produto pesado). */
  quantidade: number;
  valorUnitario: Centavos;
  desconto: Centavos;
  tributacao: TributacaoItem;
};

/** Formas da venda do NERP. Espelha o enum `PaymentMethod` do banco. */
export type FormaPagamento =
  | "DINHEIRO"
  | "PIX"
  | "DEBITO"
  | "CREDITO"
  | "BOLETO"
  | "TRANSFERENCIA"
  | "OUTROS";

/** Código `tPag` do grupo de pagamento da NF-e/NFC-e. */
export const TPAG: Record<FormaPagamento, string> = {
  DINHEIRO: "01",
  CREDITO: "03",
  DEBITO: "04",
  BOLETO: "15",
  PIX: "17",
  TRANSFERENCIA: "18",
  OUTROS: "99",
};

export type Pagamento = { forma: FormaPagamento; valor: Centavos };

export type NotaFiscal = {
  modelo: ModeloDocumento;
  ambiente: Ambiente;
  emitente: Emitente;
  destinatario?: Destinatario | null;
  itens: ItemNota[];
  pagamentos: Pagamento[];
  informacoesAdicionais?: string | null;
};

export type TotaisNota = {
  produtos: Centavos;
  descontos: Centavos;
  total: Centavos;
  pago: Centavos;
  troco: Centavos;
};

/** Valor bruto do item (`vProd`): quantidade × unitário, arredondado. */
export function valorBrutoItem(item: ItemNota): Centavos {
  return Math.round(item.quantidade * item.valorUnitario);
}

export function calcularTotais(nota: NotaFiscal): TotaisNota {
  const produtos = nota.itens.reduce((s, i) => s + valorBrutoItem(i), 0);
  const descontos = nota.itens.reduce((s, i) => s + i.desconto, 0);
  const total = produtos - descontos;
  const pago = nota.pagamentos.reduce((s, p) => s + p.valor, 0);
  return { produtos, descontos, total, pago, troco: Math.max(0, pago - total) };
}

/**
 * Distribui um desconto dado no TOTAL da venda entre os itens.
 *
 * A NF-e não tem desconto "da nota": o `vDesc` total é a soma dos `vDesc` dos
 * itens, e a SEFAZ confere. O rateio é proporcional ao valor bruto; o resto
 * dos arredondamentos vai para o item de maior valor, para a soma fechar no
 * centavo sem deixar nenhum item com desconto maior que o próprio valor.
 */
export function ratearDesconto(
  brutos: Centavos[],
  descontoTotal: Centavos,
): Centavos[] {
  const soma = brutos.reduce((s, v) => s + v, 0);
  if (descontoTotal <= 0 || soma === 0) return brutos.map(() => 0);
  if (descontoTotal > soma)
    throw new RangeError("Desconto maior que o valor dos itens");

  const partes = brutos.map((v) => Math.floor((v * descontoTotal) / soma));
  const resto = descontoTotal - partes.reduce((s, v) => s + v, 0);
  const maior = brutos.indexOf(Math.max(...brutos));
  partes[maior] += resto;
  return partes;
}

/** Real (número com casas decimais) → centavos, sem erro de float. */
export function paraCentavos(valor: number): Centavos {
  return Math.round(valor * 100);
}

/**
 * `dhEmi` no formato do XML (`YYYY-MM-DDThh:mm:ss-03:00`), no fuso do
 * emitente. Teresina é UTC-3 o ano todo (sem horário de verão desde 2019).
 */
export function formatarDhEmi(data: Date, fusoMinutos = -180): string {
  const local = new Date(data.getTime() + fusoMinutos * 60_000);
  const iso = local.toISOString().slice(0, 19);
  const sinal = fusoMinutos < 0 ? "-" : "+";
  const abs = Math.abs(fusoMinutos);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${iso}${sinal}${hh}:${mm}`;
}
