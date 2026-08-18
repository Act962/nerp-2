import type { ErpConnectionKind } from "@/generated/prisma/enums";

// Contrato entre o NERP e qualquer ERP.
//
// A regra que mantém isso genérico: os verbos aqui falam LINGUAGEM DE NEGÓCIO
// ("vendedores", "vendas por dia"), nunca linguagem de ERP. As palavras Winthor,
// Oracle, PCPEDC e CODUSUR só podem existir dentro de `winthor.ts`. Um cliente
// novo com outro ERP é um arquivo novo aqui — zero mudança em ranking ou
// dashboard.
//
// Todos os verbos são de leitura. Não existe, e não deve passar a existir,
// verbo de escrita neste contrato.

/** Intervalo fechado nos dois extremos, em dias. */
export interface DateRange {
  from: Date;
  to: Date;
}

export interface ExternalSellerDTO {
  /** Código do vendedor no ERP de origem. */
  externalCode: string;
  name: string;
  branchCode: string | null;
  supervisorCode: string | null;
  /** Nome da equipe (supervisor) — a divisão comercial usada no ranking. */
  supervisorName: string | null;
  /** Código que não representa uma pessoa (balcão, treinamento, PDV). */
  isBucket: boolean;
  isActive: boolean;
}

export interface SalesFactDTO {
  /** Dia da venda, normalizado para 00:00 UTC. */
  date: Date;
  sellerExternalCode: string;
  // Bucket FATURADO — só nota emitida (posicao 'F' no Winthor).
  revenue: number;
  cost: number;
  orders: number;
  /** Clientes distintos atendidos no dia por este vendedor (faturado). */
  customers: number;
  // Bucket PIPELINE — todo pedido não cancelado, superconjunto do faturado.
  // É o que o relatório de supervisor do Winthor conta.
  revenuePipeline: number;
  costPipeline: number;
  ordersPipeline: number;
  customersPipeline: number;
}

export interface SalesConnector {
  readonly kind: ErpConnectionKind;
  /** Cadastro de vendedores, para o vínculo código ↔ Member. */
  sellers(): Promise<ExternalSellerDTO[]>;
  /** Vendas agregadas no grão dia × vendedor. */
  salesBySellerDaily(range: DateRange): Promise<SalesFactDTO[]>;
}

// Verbos de carteira/churn (`customerCadence`) entram aqui quando o motor de
// churn for implementado — a calibração já existe, a feature ainda não.
