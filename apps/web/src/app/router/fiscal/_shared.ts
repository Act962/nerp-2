import {
  CadastroFiscalIncompletoError,
  CancelamentoRecusadoError,
  DocumentoNaoEncontradoError,
  ErroFiscal,
  JustificativaInvalidaError,
  TransicaoInvalidaError,
  VendaNaoEncontradaError,
} from "@nerp/fiscal";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";

export const fiscalProcedure = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware);

type Erros = {
  BAD_REQUEST: (o: { message: string }) => Error;
  NOT_FOUND: (o: { message: string }) => Error;
};

/**
 * Erros de `@nerp/fiscal` → erros tipados do oRPC. Cadastro incompleto volta
 * com TODAS as pendências na mensagem, para o caixa saber o que corrigir.
 */
export function traduzirErroFiscal(erro: unknown, errors: Erros): never {
  if (erro instanceof CadastroFiscalIncompletoError)
    throw errors.BAD_REQUEST({
      message: `Não dá para emitir a nota: ${erro.pendencias.map((p) => p.mensagem).join(" · ")}`,
    });
  if (
    erro instanceof VendaNaoEncontradaError ||
    erro instanceof DocumentoNaoEncontradoError
  )
    throw errors.NOT_FOUND({ message: erro.message });
  if (
    erro instanceof TransicaoInvalidaError ||
    erro instanceof JustificativaInvalidaError ||
    erro instanceof CancelamentoRecusadoError ||
    erro instanceof ErroFiscal
  )
    throw errors.BAD_REQUEST({ message: erro.message });
  throw erro;
}

/**
 * Cancelar e inutilizar mexem no que já está na SEFAZ e não se desfazem:
 * só owner/admin.
 */
export async function exigirAcessoTotal(
  organizationId: string,
  userId: string,
  acao: string,
  errors: { FORBIDDEN: (o: { message: string }) => Error },
): Promise<void> {
  const membro = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!membro || !hasFullAccess(membro.role))
    throw errors.FORBIDDEN({ message: `Apenas owner/admin ${acao}` });
}

export const statusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "AUTHORIZED",
  "REJECTED",
  "CANCELLED",
  "DENIED",
  "VOIDED",
  "CONTINGENCY",
]);

export const resumoSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  status: statusSchema,
  ambiente: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
  serie: z.number(),
  numero: z.number(),
  chave: z.string().nullable(),
  protocolo: z.string().nullable(),
  autorizadoEm: z.string().nullable(),
  qrCodeUrl: z.string().nullable(),
  consultaUrl: z.string().nullable(),
  rejeicao: z.object({ codigo: z.string(), motivo: z.string() }).nullable(),
  destinatario: z.string().nullable(),
  tentativas: z.number(),
  canceladoEm: z.string().nullable(),
  cancelavelAte: z.string().nullable(),
  temXml: z.boolean(),
  temXmlCancelamento: z.boolean(),
  emitente: z.object({
    razaoSocial: z.string(),
    cnpj: z.string(),
    inscricaoEstadual: z.string(),
    endereco: z.string(),
  }),
  tributosAproximados: z.number().nullable(),
});
