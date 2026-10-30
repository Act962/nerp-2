import type { Pendencia } from "./erros";
import {
  type RegimeTributario,
  type TributacaoItem,
  usaCsosn,
} from "./nota-fiscal";
import { CSOSN, CST_ICMS, CST_PIS_COFINS_VALIDO, codigos } from "./tabelas";

/**
 * Cadastro fiscal do PRODUTO — o que fica salvo no ERP, antes de virar item
 * de nota.
 *
 * Duas camadas: o que o produto tem e o PADRÃO da empresa. Num mercadinho do
 * Simples, 90% dos produtos são "revenda, CSOSN 102, PIS/COFINS 49"; o padrão
 * cobre esses, e o contador só mexe nas exceções (bebida em ST, isentos). O
 * NCM não tem padrão: é a identidade de cada produto.
 */

export type CadastroFiscalProduto = {
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  origem?: string | null;
  /** CSOSN (Simples/MEI) ou CST (Regime Normal), conforme o regime. */
  cstIcms?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
  cClassTrib?: string | null;
  cstIbsCbs?: string | null;
};

export type PadroesFiscais = {
  cfop?: string | null;
  cstIcms?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
};

export type CampoFiscal = keyof CadastroFiscalProduto;

/**
 * Sugestão inicial por regime. Só para Simples/MEI: no Regime Normal o ICMS e
 * o PIS/COFINS variam demais por produto para existir um palpite seguro.
 */
export function padroesSugeridos(
  regime: RegimeTributario,
): PadroesFiscais | null {
  if (!usaCsosn(regime)) return null;
  return { cfop: "5102", cstIcms: "102", cstPis: "49", cstCofins: "49" };
}

/**
 * Tira pontuação dos códigos ("2202.10.00" → "22021000") e transforma vazio
 * em `null`. Planilha e ERP de origem mandam NCM de todo jeito.
 */
export function normalizarCodigoFiscal(
  valor: string | null | undefined,
): string | null {
  if (valor == null) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

export function normalizarCadastroFiscal<T extends CadastroFiscalProduto>(
  cadastro: T,
): T {
  const r: CadastroFiscalProduto = { ...cadastro };
  for (const campo of [
    "ncm",
    "cest",
    "cfop",
    "origem",
    "cstIcms",
    "cstPis",
    "cstCofins",
    "cClassTrib",
    "cstIbsCbs",
  ] as const)
    if (campo in r) r[campo] = normalizarCodigoFiscal(r[campo]);
  return r as T;
}

const CSOSN_VALIDOS = codigos(CSOSN);
const CST_ICMS_VALIDOS = codigos(CST_ICMS);

/**
 * Confere o FORMATO dos campos preenchidos. Campo vazio não é erro aqui — é
 * "usar o padrão" ou "ainda não cadastrado", e quem cobra isso é
 * `resolverTributacao`. Sem regime (empresa ainda sem config fiscal), o ICMS
 * aceita CSOSN ou CST.
 */
export function validarCamposFiscais(
  cadastro: CadastroFiscalProduto,
  regime?: RegimeTributario | null,
): Pendencia[] {
  const c = normalizarCadastroFiscal(cadastro);
  const p: Pendencia[] = [];
  const erro = (campo: CampoFiscal, mensagem: string) =>
    p.push({ campo, mensagem });

  if (c.ncm && !/^\d{8}$/.test(c.ncm)) erro("ncm", "NCM precisa ter 8 dígitos");
  if (c.cest && !/^\d{7}$/.test(c.cest))
    erro("cest", "CEST precisa ter 7 dígitos");
  if (c.cfop && !/^[56]\d{3}$/.test(c.cfop))
    erro(
      "cfop",
      "CFOP de venda tem 4 dígitos e começa com 5 (no estado) ou 6 (fora)",
    );
  if (c.origem && !/^[0-8]$/.test(c.origem))
    erro("origem", "Origem vai de 0 a 8");
  if (c.cstIcms) {
    const simples = regime ? usaCsosn(regime) : null;
    if (simples === true && !CSOSN_VALIDOS.has(c.cstIcms))
      erro("cstIcms", "Empresa do Simples usa CSOSN (ex.: 102, 500)");
    else if (simples === false && !CST_ICMS_VALIDOS.has(c.cstIcms))
      erro("cstIcms", "Empresa do Regime Normal usa CST de ICMS (ex.: 00, 60)");
    else if (
      simples === null &&
      !CSOSN_VALIDOS.has(c.cstIcms) &&
      !CST_ICMS_VALIDOS.has(c.cstIcms)
    )
      erro("cstIcms", "Código de ICMS não reconhecido");
  }
  if (c.cstPis && !CST_PIS_COFINS_VALIDO.test(c.cstPis))
    erro("cstPis", "CST de PIS inválido");
  if (c.cstCofins && !CST_PIS_COFINS_VALIDO.test(c.cstCofins))
    erro("cstCofins", "CST de COFINS inválido");
  if (c.cClassTrib && !/^\d{6}$/.test(c.cClassTrib))
    erro("cClassTrib", "cClassTrib tem 6 dígitos");
  if (c.cstIbsCbs && !/^\d{3}$/.test(c.cstIbsCbs))
    erro("cstIbsCbs", "CST de IBS/CBS tem 3 dígitos");

  return p;
}

export type TributacaoResolvida = {
  ncm: string;
  cest: string | null;
  cfop: string;
  tributacao: TributacaoItem;
  /** Campos que vieram do padrão da empresa, não do produto. */
  usouPadrao: CampoFiscal[];
};

export type ResultadoResolucao =
  | { ok: true; valor: TributacaoResolvida }
  | {
      ok: false;
      /** FORMATO: algum código está errado. INCOMPLETO: falta campo. */
      motivo: "FORMATO" | "INCOMPLETO";
      pendencias: Pendencia[];
    };

/**
 * Produto + padrão da empresa → tributação pronta para virar item de nota.
 * É a mesma regra na tela de prontidão e na montagem da nota: um produto que a
 * tela mostra como pronto não pode ser recusado na hora de emitir.
 */
export function resolverTributacao(
  cadastro: CadastroFiscalProduto,
  padroes: PadroesFiscais | null,
  regime: RegimeTributario,
): ResultadoResolucao {
  const formato = validarCamposFiscais(cadastro, regime);
  const padrao = normalizarCadastroFiscal(padroes ?? {});
  const formatoPadrao = validarCamposFiscais(padrao, regime).map((p) => ({
    ...p,
    mensagem: `Padrão da empresa: ${p.mensagem}`,
  }));
  if (formato.length > 0 || formatoPadrao.length > 0)
    return {
      ok: false,
      motivo: "FORMATO",
      pendencias: [...formato, ...formatoPadrao],
    };

  const c = normalizarCadastroFiscal(cadastro);
  const usouPadrao: CampoFiscal[] = [];
  const efetivo = (campo: "cfop" | "cstIcms" | "cstPis" | "cstCofins") => {
    if (c[campo]) return c[campo];
    if (padrao[campo]) {
      usouPadrao.push(campo);
      return padrao[campo];
    }
    return null;
  };

  const cfop = efetivo("cfop");
  const cstIcms = efetivo("cstIcms");
  const cstPis = efetivo("cstPis");
  const cstCofins = efetivo("cstCofins");

  const faltando: Pendencia[] = [];
  if (!c.ncm) faltando.push({ campo: "ncm", mensagem: "Sem NCM" });
  if (!cfop)
    faltando.push({
      campo: "cfop",
      mensagem: "Sem CFOP (nem padrão da empresa)",
    });
  if (!cstIcms)
    faltando.push({ campo: "cstIcms", mensagem: "Sem CSOSN/CST de ICMS" });
  if (!cstPis) faltando.push({ campo: "cstPis", mensagem: "Sem CST de PIS" });
  if (!cstCofins)
    faltando.push({ campo: "cstCofins", mensagem: "Sem CST de COFINS" });
  if (!c.ncm || !cfop || !cstIcms || !cstPis || !cstCofins)
    return { ok: false, motivo: "INCOMPLETO", pendencias: faltando };

  return {
    ok: true,
    valor: {
      ncm: c.ncm,
      cest: c.cest ?? null,
      cfop,
      usouPadrao,
      tributacao: {
        origem: c.origem ?? "0",
        icms: usaCsosn(regime)
          ? { regime: "SIMPLES", csosn: cstIcms }
          : { regime: "NORMAL", cst: cstIcms },
        pis: { cst: cstPis },
        cofins: { cst: cstCofins },
        ibsCbs:
          c.cstIbsCbs && c.cClassTrib
            ? { cst: c.cstIbsCbs, cClassTrib: c.cClassTrib }
            : null,
      },
    },
  };
}
