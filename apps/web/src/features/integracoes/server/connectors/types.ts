import type { Capacidade } from "../../catalog/types";

// Contrato entre o NERP e qualquer provedor financeiro.
//
// A regra que mantém isso genérico é a mesma do conector de ERP: os verbos e os
// DTOs falam LINGUAGEM DE NEGÓCIO. As palavras Inter, PagBank e Cielo só podem
// existir dentro do arquivo do próprio conector. Provedor novo é um arquivo
// aqui — zero mudança em quem consome.
//
// Todos os verbos são de leitura, e não devem passar a existir verbos de
// escrita: o catálogo lê extrato para conciliar, não movimenta dinheiro.

/** Intervalo fechado nos dois extremos, em dias. */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Uma linha de extrato ou de movimento de adquirente.
 *
 * `valorCentavos` é inteiro e assinado (positivo entra, negativo sai) — em
 * dinheiro, `number` fracionário acumula erro de ponto flutuante justamente na
 * soma, que é o que a conciliação faz o tempo todo.
 */
export interface MovimentoDTO {
  /** Id no provedor, quando existe — chave de idempotência ao persistir. */
  idExterno: string | null;
  /** Dia do lançamento, ISO `YYYY-MM-DD`. Extrato não tem hora confiável. */
  data: string;
  descricao: string;
  valorCentavos: number;
  documento: string | null;
  tipo: "CREDITO" | "DEBITO";
}

export interface SaldoDTO {
  valorCentavos: number;
  /** Momento da leitura, ISO. */
  lidoEm: string;
}

export interface TesteConexao {
  ok: boolean;
  /** Texto pronto para a tela — já sanitizado de credencial. */
  mensagem: string;
}

export interface FinancialConnector {
  readonly capacidades: Capacidade[];
  /**
   * Chamada barata que prova credencial + conectividade. Nunca lança por
   * credencial errada: isso é resultado, não exceção.
   */
  testarConexao(): Promise<TesteConexao>;
  buscarExtrato?(range: DateRange): Promise<MovimentoDTO[]>;
  buscarSaldo?(): Promise<SaldoDTO>;
}
