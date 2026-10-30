import type {
  ProvedorFiscal,
  RespostaCancelamento,
  RespostaEmissao,
  RespostaInutilizacao,
  SolicitacaoCancelamento,
  SolicitacaoEmissao,
  SolicitacaoInutilizacao,
} from "../aplicacao/portas";
import { type ModeloDocumento, TP_EMIS, montarChave } from "../core/chave";
import {
  ProvedorIndisponivelError,
  ReferenciaDesconhecidaError,
} from "../dominio/erros";
import { somenteDigitos } from "../dominio/identificadores";
import { formatarDhEmi } from "../dominio/nota-fiscal";
import { qrCodeOnline } from "../core/qrcode";

/**
 * Provedor de mentira que se comporta como um de verdade: devolve chave de
 * acesso válida, respeita a idempotência da `ref`, rejeita NCM inexistente e
 * pode simular SEFAZ assíncrona ou fora do ar.
 *
 * Serve aos testes dos casos de uso e, por passar no MESMO teste de contrato
 * que a Focus terá de passar, é a prova de que o contrato é cumprível. Também
 * pode virar o "modo demonstração" de quem ainda não tem certificado.
 */

export type ModoSimulado = "IMEDIATO" | "ASSINCRONO";

type Registro = {
  solicitacao: SolicitacaoEmissao;
  resposta: RespostaEmissao;
  pendente: RespostaEmissao | null;
};

/** NCM usado para provocar rejeição — não existe na tabela. */
export const NCM_INEXISTENTE = "00000000";

/** Não é endereço da SEFAZ: o DANFCe simulado deixa claro que não vale. */
const URL_SIMULADA = "https://simulado.nerp.invalid/nfce/consulta";

export class ProvedorFiscalSimulado implements ProvedorFiscal {
  readonly nome = "Simulado";

  modo: ModoSimulado;
  indisponivel = false;
  recusarCancelamento = false;
  /** Quantas vezes `emitir` foi chamado — para provar que não houve reenvio. */
  chamadasEmitir = 0;

  private readonly registros = new Map<string, Registro>();
  private readonly inutilizadas: SolicitacaoInutilizacao[] = [];
  private protocolos = 0;

  constructor(opcoes: { modo?: ModoSimulado } = {}) {
    this.modo = opcoes.modo ?? "IMEDIATO";
  }

  async emitir(solicitacao: SolicitacaoEmissao): Promise<RespostaEmissao> {
    this.exigirDisponivel();
    this.chamadasEmitir += 1;

    const existente = this.registros.get(solicitacao.ref);
    if (existente && existente.resposta.situacao !== "REJEITADA")
      return existente.resposta;

    const final = this.decidir(solicitacao);
    const assincrono =
      this.modo === "ASSINCRONO" && final.situacao === "AUTORIZADA";
    const registro: Registro = {
      solicitacao,
      resposta: assincrono ? { situacao: "PROCESSANDO" } : final,
      pendente: assincrono ? final : null,
    };
    this.registros.set(solicitacao.ref, registro);
    return registro.resposta;
  }

  async consultar(
    ref: string,
    _modelo: ModeloDocumento,
  ): Promise<RespostaEmissao> {
    this.exigirDisponivel();
    const registro = this.registros.get(ref);
    if (!registro) throw new ReferenciaDesconhecidaError(ref);
    if (registro.pendente) {
      registro.resposta = registro.pendente;
      registro.pendente = null;
    }
    return registro.resposta;
  }

  async cancelar(
    solicitacao: SolicitacaoCancelamento,
  ): Promise<RespostaCancelamento> {
    this.exigirDisponivel();
    const registro = this.registros.get(solicitacao.ref);
    if (!registro) throw new ReferenciaDesconhecidaError(solicitacao.ref);
    if (registro.resposta.situacao !== "AUTORIZADA")
      return {
        situacao: "RECUSADA",
        codigo: "217",
        motivo: "NF-e não consta na base de dados da SEFAZ",
      };
    if (this.recusarCancelamento)
      return {
        situacao: "RECUSADA",
        codigo: "501",
        motivo: "Prazo de cancelamento superior ao previsto na legislação",
      };
    return {
      situacao: "CANCELADA",
      protocolo: this.novoProtocolo(),
      canceladaEm: new Date(),
      xml: {
        bytes: new TextEncoder().encode(
          `<procEventoNFe chave="${solicitacao.chave}" tpEvento="110111"/>`,
        ),
        contentType: "application/xml",
      },
    };
  }

  async inutilizar(
    solicitacao: SolicitacaoInutilizacao,
  ): Promise<RespostaInutilizacao> {
    this.exigirDisponivel();
    const { serie, numeroInicial, numeroFinal, modelo } = solicitacao;
    const naFaixa = (n: number) => n >= numeroInicial && n <= numeroFinal;
    // Na SEFAZ a numeração é por emitente: o nº 1 de um CNPJ não tem nada a
    // ver com o nº 1 de outro.
    const cnpj = somenteDigitos(solicitacao.cnpj);

    const usada = [...this.registros.values()].some(
      (r) =>
        somenteDigitos(r.solicitacao.nota.emitente.cnpj) === cnpj &&
        r.solicitacao.nota.modelo === modelo &&
        r.solicitacao.serie === serie &&
        naFaixa(r.solicitacao.numero) &&
        r.resposta.situacao !== "REJEITADA",
    );
    if (usada)
      return {
        situacao: "RECUSADA",
        codigo: "241",
        motivo: "Um número da faixa já foi utilizado",
      };
    const jaInutilizada = this.inutilizadas.some(
      (f) =>
        somenteDigitos(f.cnpj) === cnpj &&
        f.modelo === modelo &&
        f.serie === serie &&
        numeroInicial <= f.numeroFinal &&
        numeroFinal >= f.numeroInicial,
    );
    if (jaInutilizada)
      return {
        situacao: "RECUSADA",
        codigo: "256",
        motivo:
          "Uma NF-e da faixa já está inutilizada na Base de dados da SEFAZ",
      };

    this.inutilizadas.push(solicitacao);
    return {
      situacao: "INUTILIZADA",
      protocolo: this.novoProtocolo(),
      inutilizadaEm: new Date(),
      xml: {
        bytes: new TextEncoder().encode(
          `<procInutNFe serie="${serie}" nNFIni="${numeroInicial}" nNFFin="${numeroFinal}"/>`,
        ),
        contentType: "application/xml",
      },
    };
  }

  private decidir(s: SolicitacaoEmissao): RespostaEmissao {
    if (s.nota.itens.some((i) => i.ncm === NCM_INEXISTENTE))
      return {
        situacao: "REJEITADA",
        codigo: "778",
        motivo: "Informado NCM inexistente",
      };

    const chave = montarChave({
      uf: s.nota.emitente.endereco.uf,
      dhEmi: formatarDhEmi(s.emitidaEm),
      cnpj: s.nota.emitente.cnpj,
      modelo: s.nota.modelo,
      serie: s.serie,
      numero: s.numero,
      tpEmis: TP_EMIS.NORMAL,
      // Qualquer valor de 8 dígitos diferente do número serve.
      cNF: String((s.numero + 12_345_678) % 100_000_000).padStart(8, "0"),
    });
    const texto = new TextEncoder();
    return {
      situacao: "AUTORIZADA",
      chave,
      protocolo: this.novoProtocolo(),
      autorizadaEm: s.emitidaEm,
      xml: {
        bytes: texto.encode(`<nfeProc chave="${chave}"/>`),
        contentType: "application/xml",
      },
      danfe: {
        bytes: texto.encode("%PDF-simulado"),
        contentType: "application/pdf",
      },
      // QR v3 (NT 2025.001): online é só chave|versão|ambiente.
      qrCodeUrl: qrCodeOnline({
        urlConsulta: URL_SIMULADA,
        chNFe: chave,
        versao: 3,
        tpAmb: s.nota.ambiente === "PRODUCAO" ? 1 : 2,
      }).url,
      consultaUrl: URL_SIMULADA,
    };
  }

  private novoProtocolo(): string {
    this.protocolos += 1;
    return `1220000${String(this.protocolos).padStart(8, "0")}`;
  }

  private exigirDisponivel(): void {
    if (this.indisponivel)
      throw new ProvedorIndisponivelError(this.nome, "simulação de queda");
  }
}
