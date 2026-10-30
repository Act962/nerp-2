/**
 * Erros do domínio fiscal. Cada um tem um `codigo` estável para a borda (oRPC,
 * Inngest) decidir o que fazer sem comparar mensagem.
 *
 * A divisão que importa para a emissão:
 *
 * - erro de NEGÓCIO (cadastro incompleto, transição inválida) — não adianta
 *   tentar de novo; alguém precisa corrigir algo;
 * - `ProvedorIndisponivelError` — falha momentânea; o Inngest refaz o passo, e
 *   o contrato do provedor garante que reenviar a mesma `ref` não duplica nota.
 */
export class ErroFiscal extends Error {
  readonly codigo: string;

  constructor(codigo: string, message: string) {
    super(message);
    this.codigo = codigo;
    this.name = new.target.name;
  }
}

export type Pendencia = {
  /** Caminho do campo, ex.: `emitente.cnpj`, `itens[2].ncm`. */
  campo: string;
  mensagem: string;
  /** Índice do item quando a pendência é de um produto da nota. */
  itemIndice?: number;
};

export class CadastroFiscalIncompletoError extends ErroFiscal {
  readonly pendencias: Pendencia[];

  constructor(pendencias: Pendencia[]) {
    super(
      "CADASTRO_FISCAL_INCOMPLETO",
      `A nota não pode ser emitida: ${pendencias.length} pendência(s) no cadastro fiscal`,
    );
    this.pendencias = pendencias;
  }
}

export class TransicaoInvalidaError extends ErroFiscal {
  constructor(de: string, acao: string) {
    super(
      "TRANSICAO_INVALIDA",
      `Documento fiscal em ${de} não permite ${acao}`,
    );
  }
}

export class JustificativaInvalidaError extends ErroFiscal {
  constructor() {
    super(
      "JUSTIFICATIVA_INVALIDA",
      "A justificativa precisa ter entre 15 e 255 caracteres",
    );
  }
}

export class DocumentoNaoEncontradoError extends ErroFiscal {
  constructor() {
    super("DOCUMENTO_NAO_ENCONTRADO", "Documento fiscal não encontrado");
  }
}

export class VendaNaoEncontradaError extends ErroFiscal {
  constructor() {
    super("VENDA_NAO_ENCONTRADA", "Venda não encontrada");
  }
}

/**
 * O provedor não respondeu ou respondeu 5xx/timeout. É o ÚNICO erro que deve
 * subir para o retry automático — rejeição da SEFAZ não é falha, é resposta.
 */
export class ProvedorIndisponivelError extends ErroFiscal {
  constructor(provedor: string, detalhe: string) {
    super("PROVEDOR_INDISPONIVEL", `${provedor} indisponível: ${detalhe}`);
  }
}

/** Consulta de uma `ref` que o provedor nunca recebeu. */
export class ReferenciaDesconhecidaError extends ErroFiscal {
  constructor(ref: string) {
    super("REFERENCIA_DESCONHECIDA", `O provedor não conhece a ref ${ref}`);
  }
}

/** Cancelamento recusado pela SEFAZ — ex.: fora do prazo legal. */
export class CancelamentoRecusadoError extends ErroFiscal {
  readonly codigoSefaz: string;

  constructor(codigoSefaz: string, motivo: string) {
    super("CANCELAMENTO_RECUSADO", motivo);
    this.codigoSefaz = codigoSefaz;
  }
}

/** Passou o prazo legal de cancelamento (30 min na NFC-e, 24 h na NF-e). */
export class CancelamentoForaDoPrazoError extends ErroFiscal {
  constructor(prazo: Date) {
    super(
      "CANCELAMENTO_FORA_DO_PRAZO",
      `O prazo para cancelar esta nota terminou em ${prazo.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}. Fora do prazo, o caminho é a devolução.`,
    );
  }
}

/** Faixa de inutilização que não pode ser pedida (fora do reservado, já usada…). */
export class FaixaInvalidaError extends ErroFiscal {
  constructor(motivo: string) {
    super("FAIXA_INVALIDA", motivo);
  }
}

/** Inutilização recusada pela SEFAZ — ex.: 241, um número da faixa já foi usado. */
export class InutilizacaoRecusadaError extends ErroFiscal {
  readonly codigoSefaz: string;

  constructor(codigoSefaz: string, motivo: string) {
    super(
      "INUTILIZACAO_RECUSADA",
      `SEFAZ recusou a inutilização (${codigoSefaz}): ${motivo}`,
    );
    this.codigoSefaz = codigoSefaz;
  }
}
