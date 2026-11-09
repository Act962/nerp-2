import "server-only";

import { ErroFiscal, ProvedorIndisponivelError } from "@nerp/fiscal";

/**
 * API de empresas da Focus (doc.focusnfe.com.br/reference/criar_empresa):
 * com o token da CONTA (revenda), cadastra o emitente de cada cliente do NERP
 * e recebe de volta os tokens daquela empresa — o cliente não precisa de login
 * na Focus nem copiar token de painel nenhum.
 *
 * Só existe em `api.focusnfe.com.br`, inclusive para empresa que vai emitir em
 * homologação: o ambiente da NOTA é escolhido pelo token da empresa, não aqui.
 */
const BASE_URL = "https://api.focusnfe.com.br";
const TIMEOUT_MS = 20_000;

type RegimeEmpresa =
  | "SIMPLES_NACIONAL"
  | "SIMPLES_MEI"
  | "LUCRO_PRESUMIDO"
  | "LUCRO_REAL";

export type DadosEmpresaFocus = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  inscricaoEstadual: string;
  inscricaoMunicipal: string | null;
  regime: RegimeEmpresa;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string | null;
  email: string | null;
  ambiente: "HOMOLOGACAO" | "PRODUCAO";
  /** Só quando o certificado mudou ou a empresa ainda não existe na Focus. */
  certificado: { pfx: Buffer; senha: string } | null;
  csc: { id: string; codigo: string } | null;
  serieNfce: number;
};

export type PedidoEmpresaFocus = Record<string, string | number | boolean>;

// 2 (excesso de sublimite) não existe no NERP: quem estoura o sublimite passa
// a ser tratado pelo contador como Regime Normal no cadastro.
const REGIME_FOCUS: Record<RegimeEmpresa, number> = {
  SIMPLES_NACIONAL: 1,
  SIMPLES_MEI: 4,
  LUCRO_PRESUMIDO: 3,
  LUCRO_REAL: 3,
};

const digitos = (v: string) => v.replace(/\D/g, "");

/**
 * Corpo do POST/PUT `/v2/empresas`. Puro, para o teste conferir cada campo.
 *
 * - A IE e o CEP vão como texto de dígitos, não como número (a referência os
 *   tipa como inteiro): IE com zero à esquerda perderia o zero — a confirmar
 *   contra a Focus de verdade.
 * - O CSC vai no campo do ambiente atual; o outro fica como está na Focus.
 * - `proximo_numero_nfce_*` não vai: o NERP é dono da numeração e manda
 *   `serie`/`numero` em cada nota.
 * - `discrimina_impostos` desligado: os tributos aproximados saem do percentual
 *   do contador (`approxTaxPercent`), item a item, e não de uma tabela da Focus.
 */
export function paraEmpresaFocus(d: DadosEmpresaFocus): PedidoEmpresaFocus {
  const sufixo = d.ambiente === "PRODUCAO" ? "producao" : "homologacao";
  return {
    cnpj: digitos(d.cnpj),
    nome: d.razaoSocial,
    ...(d.nomeFantasia && { nome_fantasia: d.nomeFantasia }),
    inscricao_estadual: digitos(d.inscricaoEstadual),
    ...(d.inscricaoMunicipal && {
      inscricao_municipal: digitos(d.inscricaoMunicipal),
    }),
    regime_tributario: REGIME_FOCUS[d.regime],
    logradouro: d.logradouro,
    numero: d.numero,
    ...(d.complemento && { complemento: d.complemento }),
    bairro: d.bairro,
    municipio: d.municipio,
    uf: d.uf,
    cep: digitos(d.cep),
    ...(d.telefone && { telefone: digitos(d.telefone) }),
    ...(d.email && { email: d.email }),
    habilita_nfce: true,
    discrimina_impostos: false,
    [`serie_nfce_${sufixo}`]: String(d.serieNfce),
    ...(d.csc && {
      [`csc_nfce_${sufixo}`]: d.csc.codigo,
      [`id_token_nfce_${sufixo}`]: d.csc.id,
    }),
    ...(d.certificado && {
      arquivo_certificado_base64: d.certificado.pfx.toString("base64"),
      senha_certificado: d.certificado.senha,
    }),
  };
}

export type EmpresaFocus = {
  id: string;
  tokenHomologacao: string | null;
  tokenProducao: string | null;
  certificadoValidoAte: Date | null;
};

type RespostaEmpresaFocus = {
  id?: number | string;
  token_homologacao?: string | null;
  token_producao?: string | null;
  certificado_valido_ate?: string | null;
};

function lerEmpresa(r: RespostaEmpresaFocus): EmpresaFocus {
  if (r.id == null)
    throw new ErroFiscal(
      "PROVEDOR_PEDIDO_INVALIDO",
      "A Focus não devolveu o ID da empresa",
    );
  const validade = r.certificado_valido_ate
    ? new Date(r.certificado_valido_ate)
    : null;
  return {
    id: String(r.id),
    tokenHomologacao: r.token_homologacao || null,
    tokenProducao: r.token_producao || null,
    certificadoValidoAte:
      validade && !Number.isNaN(validade.getTime()) ? validade : null,
  };
}

export class EmpresasFocus {
  private readonly auth: string;
  private readonly fetch: typeof fetch;

  constructor(opcoes: { tokenConta: string; fetch?: typeof fetch }) {
    this.auth = `Basic ${Buffer.from(`${opcoes.tokenConta}:`).toString("base64")}`;
    this.fetch = opcoes.fetch ?? fetch;
  }

  async buscarPorCnpj(cnpj: string): Promise<EmpresaFocus | null> {
    const r = await this.http(
      "GET",
      `/v2/empresas?cnpj=${encodeURIComponent(digitos(cnpj))}`,
    );
    if (r.status !== 200) throw erroDoPedido(r);
    const lista = Array.isArray(r.corpo)
      ? (r.corpo as RespostaEmpresaFocus[])
      : [];
    return lista[0] ? lerEmpresa(lista[0]) : null;
  }

  /**
   * Cria, ou atualiza se a empresa já existe — pelo ID gravado no NERP ou, na
   * falta dele, pelo CNPJ (empresa cadastrada antes à mão no painel).
   */
  async salvar(
    pedido: PedidoEmpresaFocus,
    idConhecido: string | null,
  ): Promise<{ empresa: EmpresaFocus; criada: boolean }> {
    const id =
      idConhecido ?? (await this.buscarPorCnpj(String(pedido.cnpj)))?.id;
    if (id) {
      const r = await this.http(
        "PUT",
        `/v2/empresas/${encodeURIComponent(id)}`,
        pedido,
      );
      if (r.status === 404 && idConhecido)
        // ID gravado ficou velho (empresa excluída no painel): tenta pelo CNPJ.
        return this.salvar(pedido, null);
      if (r.status !== 200) throw erroDoPedido(r);
      return {
        empresa: lerEmpresa(r.corpo as RespostaEmpresaFocus),
        criada: false,
      };
    }
    const r = await this.http("POST", "/v2/empresas", pedido);
    if (r.status !== 200 && r.status !== 201) throw erroDoPedido(r);
    return {
      empresa: lerEmpresa(r.corpo as RespostaEmpresaFocus),
      criada: true,
    };
  }

  private async http(
    metodo: "GET" | "POST" | "PUT",
    caminho: string,
    corpo?: unknown,
  ): Promise<{ status: number; corpo: unknown }> {
    let res: Response;
    try {
      res = await this.fetch(`${BASE_URL}${caminho}`, {
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
      throw new ProvedorIndisponivelError(
        "Focus NFe",
        erro instanceof Error ? erro.message : String(erro),
      );
    }
    if (res.status >= 500)
      throw new ProvedorIndisponivelError("Focus NFe", `HTTP ${res.status}`);
    const texto = await res.text();
    try {
      return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
    } catch {
      // 401 vem em HTML ("HTTP Basic: Access denied").
      return { status: res.status, corpo: { mensagem: texto.slice(0, 200) } };
    }
  }
}

type ErroCampo = { mensagem?: string; campo?: string };

function erroDoPedido(r: { status: number; corpo: unknown }): ErroFiscal {
  if (r.status === 401 || r.status === 403)
    return new ErroFiscal(
      "PROVEDOR_CREDENCIAL",
      "A Focus recusou o token da conta (FOCUS_TOKEN_CONTA)",
    );
  const corpo = (r.corpo ?? {}) as { mensagem?: string; erros?: ErroCampo[] };
  const detalhes = (corpo.erros ?? [])
    .map((e) => (e.campo ? `${e.campo}: ${e.mensagem}` : e.mensagem))
    .filter(Boolean);
  const mensagem = [corpo.mensagem, ...detalhes].filter(Boolean).join(" — ");
  return new ErroFiscal(
    "PROVEDOR_PEDIDO_INVALIDO",
    `A Focus recusou o cadastro da empresa (${r.status}): ${mensagem || "sem detalhes"}`,
  );
}
