import "server-only";

import {
  type ArquivoFiscal,
  ErroFiscal,
  type ModeloDocumento,
  type ProvedorFiscal,
  ProvedorIndisponivelError,
  ReferenciaDesconhecidaError,
  type RespostaCancelamento,
  type RespostaEmissao,
  type RespostaInutilizacao,
  type SolicitacaoCancelamento,
  type SolicitacaoEmissao,
  type SolicitacaoInutilizacao,
} from "@nerp/fiscal";
import {
  type RespostaNfceFocus,
  lerProtocoloDoXml,
  paraPedidoFocus,
  situacaoDaFocus,
} from "./mapeador";

const BASE_URLS = {
  HOMOLOGACAO: "https://homologacao.focusnfe.com.br",
  PRODUCAO: "https://api.focusnfe.com.br",
} as const;

const TIMEOUT_MS = 20_000;

type Fetch = typeof fetch;

export type OpcoesProvedorFocus = {
  token: string;
  ambiente: keyof typeof BASE_URLS;
  /** Injetável para o teste rodar o contrato sem rede. */
  fetch?: Fetch;
  agora?: () => Date;
};

type RespostaHttp = { status: number; corpo: unknown };

type RespostaInutilizacaoFocus = {
  status?: "autorizado" | "erro_autorizacao";
  status_sefaz?: string;
  mensagem_sefaz?: string;
  protocolo_sefaz?: string;
  caminho_xml?: string;
};

/**
 * `ProvedorFiscal` da Focus NFe (NFC-e). Cumpre o contrato de
 * `@nerp/fiscal/aplicacao/portas.ts`:
 *
 * - Reenvio da mesma `ref`: antes do POST consulta a ref; se ela já existe e
 *   não foi rejeitada, devolve a situação dela em vez de emitir de novo. A
 *   Focus também recusa (422 `already_processed`/`pending_operation`), e esses
 *   dois casos caem na consulta.
 * - Rejeição da SEFAZ (`erro_autorizacao`) é resposta, não exceção.
 * - Rede, timeout e 5xx viram `ProvedorIndisponivelError` (vai para o retry).
 * - Credencial recusada (401/403) e pedido inválido (400/422) são `ErroFiscal`
 *   — repetir não resolve; alguém precisa corrigir a configuração.
 */
export class ProvedorFocus implements ProvedorFiscal {
  readonly nome = "Focus NFe";

  private readonly base: string;
  private readonly auth: string;
  private readonly fetch: Fetch;
  private readonly agora: () => Date;

  constructor(opcoes: OpcoesProvedorFocus) {
    this.base = BASE_URLS[opcoes.ambiente];
    this.auth = `Basic ${Buffer.from(`${opcoes.token}:`).toString("base64")}`;
    this.fetch = opcoes.fetch ?? fetch;
    this.agora = opcoes.agora ?? (() => new Date());
  }

  async emitir(s: SolicitacaoEmissao): Promise<RespostaEmissao> {
    const existente = await this.http("GET", this.caminho(s.ref));
    if (existente.status === 200) {
      const corpo = existente.corpo as RespostaNfceFocus;
      if (corpo.status !== "erro_autorizacao") return this.traduzir(corpo);
    }

    const r = await this.http(
      "POST",
      `/v2/nfce?ref=${encodeURIComponent(s.ref)}`,
      paraPedidoFocus(s),
    );
    if (r.status === 200 || r.status === 201)
      return this.traduzir(r.corpo as RespostaNfceFocus);

    const codigo = codigoDoErro(r.corpo);
    if (codigo === "already_processed" || codigo === "pending_operation")
      return this.consultar(s.ref, s.nota.modelo);
    throw this.erroDoPedido(r);
  }

  async consultar(
    ref: string,
    _modelo: ModeloDocumento,
  ): Promise<RespostaEmissao> {
    const r = await this.http("GET", this.caminho(ref));
    if (r.status === 404) throw new ReferenciaDesconhecidaError(ref);
    if (r.status !== 200) throw this.erroDoPedido(r);
    return this.traduzir(r.corpo as RespostaNfceFocus);
  }

  async cancelar(s: SolicitacaoCancelamento): Promise<RespostaCancelamento> {
    const r = await this.http("DELETE", this.caminho(s.ref), {
      justificativa: s.justificativa,
    });
    if (r.status === 404) throw new ReferenciaDesconhecidaError(s.ref);
    const corpo = r.corpo as RespostaNfceFocus & {
      codigo?: string;
      mensagem?: string;
      caminho_xml_cancelamento?: string;
    };
    if (r.status === 200 && corpo.status === "cancelado")
      return {
        situacao: "CANCELADA",
        protocolo: corpo.numero_protocolo ?? corpo.protocolo ?? "",
        canceladaEm: this.agora(),
        xml: await this.baixarSePossivel(corpo.caminho_xml_cancelamento),
      };
    if (r.status === 200)
      return {
        situacao: "RECUSADA",
        codigo: corpo.status_sefaz ?? "000",
        motivo: corpo.mensagem_sefaz ?? "Cancelamento recusado",
      };
    if (r.status === 422)
      return {
        situacao: "RECUSADA",
        codigo: corpo.codigo ?? "422",
        motivo: corpo.mensagem ?? "Cancelamento recusado pela Focus",
      };
    throw this.erroDoPedido(r);
  }

  /**
   * `POST /v2/nfce/inutilizacao` (ou `/v2/nfe/…`), síncrono. Recusa da SEFAZ
   * vem com HTTP 200 e `status: "erro_autorizacao"` — é resposta, não erro.
   */
  async inutilizar(s: SolicitacaoInutilizacao): Promise<RespostaInutilizacao> {
    const tipo = s.modelo === 65 ? "nfce" : "nfe";
    const r = await this.http("POST", `/v2/${tipo}/inutilizacao`, {
      cnpj: s.cnpj,
      serie: String(s.serie),
      numero_inicial: String(s.numeroInicial),
      numero_final: String(s.numeroFinal),
      justificativa: s.justificativa,
    });
    if (r.status !== 200) throw this.erroDoPedido(r);
    const corpo = r.corpo as RespostaInutilizacaoFocus;
    if (corpo.status !== "autorizado")
      return {
        situacao: "RECUSADA",
        codigo: corpo.status_sefaz ?? "000",
        motivo: corpo.mensagem_sefaz ?? "Inutilização recusada",
      };
    return {
      situacao: "INUTILIZADA",
      protocolo: corpo.protocolo_sefaz ?? "",
      inutilizadaEm: this.agora(),
      xml: await this.baixarSePossivel(corpo.caminho_xml),
    };
  }

  private async traduzir(r: RespostaNfceFocus): Promise<RespostaEmissao> {
    const situacao = situacaoDaFocus(r);
    if ("situacao" in situacao) return situacao;
    if (situacao.tipo === "PROCESSANDO") return { situacao: "PROCESSANDO" };

    const xml = r.caminho_xml_nota_fiscal
      ? await this.baixar(r.caminho_xml_nota_fiscal)
      : null;
    const doXml = xml
      ? lerProtocoloDoXml(new TextDecoder().decode(xml.bytes))
      : { protocolo: null, autorizadaEm: null };
    return {
      situacao: "AUTORIZADA",
      chave: (r.chave_nfe ?? "").replace(/\D/g, ""),
      protocolo: doXml.protocolo ?? r.protocolo ?? r.numero_protocolo ?? "",
      autorizadaEm: doXml.autorizadaEm ?? this.agora(),
      xml,
      // O DANFCe da Focus é HTML; o NERP imprime o próprio a partir da chave,
      // do protocolo e do QR Code.
      danfe: null,
      qrCodeUrl: r.qrcode_url ?? null,
      consultaUrl: r.url_consulta_nf ?? null,
    };
  }

  private async baixar(caminho: string): Promise<ArquivoFiscal> {
    const res = await this.requisitar("GET", caminho);
    if (!res.ok)
      throw new ProvedorIndisponivelError(
        this.nome,
        `XML autorizado indisponível (${res.status})`,
      );
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: "application/xml",
    };
  }

  /**
   * Para eventos já registrados na SEFAZ (cancelamento, inutilização): sem o
   * XML o evento continua valendo, então a falha no download não pode virar
   * erro — o registro tem de ser gravado de qualquer jeito.
   */
  private async baixarSePossivel(
    caminho: string | undefined,
  ): Promise<ArquivoFiscal | null> {
    if (!caminho) return null;
    try {
      return await this.baixar(caminho);
    } catch (erro) {
      console.error("[fiscal] XML do evento indisponível na Focus:", erro);
      return null;
    }
  }

  private caminho(ref: string) {
    return `/v2/nfce/${encodeURIComponent(ref)}`;
  }

  private async http(
    metodo: "GET" | "POST" | "DELETE",
    caminho: string,
    corpo?: unknown,
  ): Promise<RespostaHttp> {
    const res = await this.requisitar(metodo, caminho, corpo);
    if (res.status >= 500)
      throw new ProvedorIndisponivelError(this.nome, `HTTP ${res.status}`);
    const texto = await res.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      // 401 da Focus vem em HTML ("HTTP Basic: Access denied").
      json = { mensagem: texto.slice(0, 200) };
    }
    return { status: res.status, corpo: json };
  }

  private async requisitar(
    metodo: string,
    caminho: string,
    corpo?: unknown,
  ): Promise<Response> {
    try {
      return await this.fetch(`${this.base}${caminho}`, {
        method: metodo,
        headers: {
          Authorization: this.auth,
          Accept: "application/json",
          ...(corpo !== undefined && { "Content-Type": "application/json" }),
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      throw new ProvedorIndisponivelError(this.nome, detalhe);
    }
  }

  private erroDoPedido(r: RespostaHttp): ErroFiscal {
    const mensagem = mensagemDoErro(r.corpo);
    if (r.status === 401 || r.status === 403)
      return new ErroFiscal(
        "PROVEDOR_CREDENCIAL",
        `A Focus recusou a credencial (${r.status}): ${mensagem}. Confira o token e o CNPJ em Integrações → Focus NFe.`,
      );
    return new ErroFiscal(
      "PROVEDOR_PEDIDO_INVALIDO",
      `A Focus recusou o pedido (${r.status}): ${mensagem}`,
    );
  }
}

function codigoDoErro(corpo: unknown): string | null {
  return typeof corpo === "object" &&
    corpo !== null &&
    "codigo" in corpo &&
    typeof corpo.codigo === "string"
    ? corpo.codigo
    : null;
}

function mensagemDoErro(corpo: unknown): string {
  if (typeof corpo !== "object" || corpo === null) return "sem detalhes";
  const mensagem =
    "mensagem" in corpo && typeof corpo.mensagem === "string"
      ? corpo.mensagem
      : "sem detalhes";
  const erros =
    "erros" in corpo && Array.isArray(corpo.erros)
      ? corpo.erros
          .map((e: unknown) =>
            typeof e === "object" && e !== null && "mensagem" in e
              ? String(e.mensagem)
              : "",
          )
          .filter(Boolean)
      : [];
  return erros.length > 0 ? `${mensagem} — ${erros.join("; ")}` : mensagem;
}
