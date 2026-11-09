import "server-only";

import { ErroFiscal } from "@nerp/fiscal";
import prisma from "@/lib/db";
import { decryptString, encryptString } from "@/lib/fiscal/encryption";
import { FISCAL_KEY_PREFIX, getFiscalObject } from "@/lib/fiscal/storage";
import { EmpresasFocus, paraEmpresaFocus } from "./infra/focus/empresas";

export type ResultadoCadastroFocus = {
  empresaId: string;
  criada: boolean;
  recebeuTokenHomologacao: boolean;
  recebeuTokenProducao: boolean;
};

/**
 * Leva o emitente do `FiscalConfig` para a Focus pela conta de revenda e grava
 * de volta o ID e os tokens da empresa (cifrados). Idempotente: rodar de novo
 * atualiza o cadastro — é o que se faz depois de trocar certificado ou CSC.
 *
 * O token da CONTA vem do ambiente (`FOCUS_TOKEN_CONTA`), nunca do banco: é
 * uma credencial do NERP, que cadastra empresa de qualquer cliente — não pode
 * morar numa linha que pertence a um deles.
 */
export async function cadastrarEmpresaNaFocus(
  organizationId: string,
  opcoes: { fetch?: typeof fetch } = {},
): Promise<ResultadoCadastroFocus> {
  const tokenConta = process.env.FOCUS_TOKEN_CONTA;
  if (!tokenConta)
    throw new ErroFiscal(
      "FOCUS_SEM_TOKEN_CONTA",
      "Cadastro automático na Focus indisponível: falta FOCUS_TOKEN_CONTA no servidor. Cadastre a empresa no painel da Focus e cole os tokens aqui.",
    );

  const c = await prisma.fiscalConfig.findUnique({
    where: { organizationId },
  });
  if (!c)
    throw new ErroFiscal(
      "FISCAL_NAO_CONFIGURADO",
      "Salve os dados da empresa antes de cadastrá-la na Focus",
    );

  const faltando = [
    !c.cnpj && "CNPJ",
    !c.ie && "Inscrição Estadual",
    !c.legalName && "razão social",
    !c.taxRegime && "regime tributário",
    !c.address && "logradouro",
    !c.addressNumber && "número",
    !c.neighborhood && "bairro",
    !c.cityName && "município",
    !c.zipCode && "CEP",
    !c.certificateKey && "certificado A1",
  ].filter(Boolean);
  if (faltando.length > 0)
    throw new ErroFiscal(
      "FISCAL_NAO_CONFIGURADO",
      `Para cadastrar na Focus, preencha: ${faltando.join(", ")}`,
    );
  if (
    !c.certificateKey?.startsWith(FISCAL_KEY_PREFIX) ||
    !c.certificatePasswordEnc
  )
    throw new ErroFiscal(
      "FISCAL_NAO_CONFIGURADO",
      "Reenvie o certificado A1 (com a senha) antes de cadastrar na Focus",
    );

  // O certificado vai sempre: a Focus guarda o dela, e reenviar é o que
  // mantém os dois iguais depois de uma troca feita só no NERP.
  const pedido = paraEmpresaFocus({
    cnpj: c.cnpj as string,
    razaoSocial: c.legalName as string,
    nomeFantasia: c.tradeName,
    inscricaoEstadual: c.ie as string,
    inscricaoMunicipal: c.im,
    regime: c.taxRegime as NonNullable<typeof c.taxRegime>,
    logradouro: c.address as string,
    numero: c.addressNumber as string,
    complemento: c.complement,
    bairro: c.neighborhood as string,
    municipio: c.cityName as string,
    uf: c.ufFiscal,
    cep: c.zipCode as string,
    telefone: c.fiscalPhone,
    email: c.fiscalEmail,
    ambiente: c.environment,
    certificado: {
      pfx: await getFiscalObject(c.certificateKey),
      senha: decryptString(c.certificatePasswordEnc),
    },
    csc:
      c.csc && c.cscId ? { id: c.cscId, codigo: decryptString(c.csc) } : null,
    serieNfce: c.nfceSerie ?? 1,
  });

  const { empresa, criada } = await new EmpresasFocus({
    tokenConta,
    fetch: opcoes.fetch,
  }).salvar(pedido, c.focusEmpresaId);

  // Token vazio na resposta não apaga o que já está gravado: a Focus pode só
  // liberar o de produção depois, e o colado à mão continua valendo.
  await prisma.fiscalConfig.update({
    where: { organizationId },
    data: {
      focusEmpresaId: empresa.id,
      ...(empresa.tokenHomologacao && {
        focusTokenHomolog: encryptString(empresa.tokenHomologacao),
      }),
      ...(empresa.tokenProducao && {
        focusToken: encryptString(empresa.tokenProducao),
      }),
    },
  });

  return {
    empresaId: empresa.id,
    criada,
    recebeuTokenHomologacao: !!empresa.tokenHomologacao,
    recebeuTokenProducao: !!empresa.tokenProducao,
  };
}
