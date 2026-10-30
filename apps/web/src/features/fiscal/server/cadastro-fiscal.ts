import "server-only";

import {
  type CadastroFiscalProduto,
  type PadroesFiscais,
  type Pendencia,
  type RegimeTributario,
  normalizarCodigoFiscal,
  validarCamposFiscais,
} from "@nerp/fiscal";
import prisma from "@/lib/db";

/**
 * Ponte entre o cadastro do ERP e as regras de `@nerp/fiscal`: lê o regime e
 * os padrões da empresa e prepara os campos fiscais do produto para gravar.
 */

export type PerfilTributario = {
  regime: RegimeTributario | null;
  padroes: PadroesFiscais;
};

export async function carregarPerfilTributario(
  organizationId: string,
): Promise<PerfilTributario> {
  const config = await prisma.fiscalConfig.findUnique({
    where: { organizationId },
    select: {
      taxRegime: true,
      defaultCfop: true,
      defaultCstIcms: true,
      defaultCstPis: true,
      defaultCstCofins: true,
    },
  });
  return {
    regime: config?.taxRegime ?? null,
    padroes: {
      cfop: config?.defaultCfop ?? null,
      cstIcms: config?.defaultCstIcms ?? null,
      cstPis: config?.defaultCstPis ?? null,
      cstCofins: config?.defaultCstCofins ?? null,
    },
  };
}

const CAMPOS = [
  "ncm",
  "cest",
  "cfop",
  "origem",
  "cstIcms",
  "cstPis",
  "cstCofins",
  "cClassTrib",
  "cstIbsCbs",
] as const satisfies readonly (keyof CadastroFiscalProduto)[];

type CamposFiscais = Pick<CadastroFiscalProduto, (typeof CAMPOS)[number]>;

/**
 * Normaliza ("2202.10.00" → "22021000", vazio → null) e valida o formato.
 *
 * Só devolve as chaves que vieram no input: campo ausente fica `undefined` e o
 * Prisma não mexe nele; campo vazio vira `null` e LIMPA o valor — que é o que
 * o operador quer quando apaga o CFOP para o produto voltar a usar o padrão.
 */
export async function prepararCamposFiscais(
  organizationId: string,
  input: CamposFiscais,
): Promise<{ dados: CamposFiscais; pendencias: Pendencia[] }> {
  const dados: CamposFiscais = {};
  for (const campo of CAMPOS)
    if (input[campo] !== undefined)
      dados[campo] = normalizarCodigoFiscal(input[campo]);

  const { regime } = await carregarPerfilTributario(organizationId);
  return { dados, pendencias: validarCamposFiscais(dados, regime) };
}

export function mensagemDasPendencias(pendencias: Pendencia[]): string {
  return pendencias.map((p) => p.mensagem).join(" · ");
}
