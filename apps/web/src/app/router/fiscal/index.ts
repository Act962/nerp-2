import { DocumentoFiscal, documentoValido, somenteDigitos } from "@nerp/fiscal";
import { z } from "zod";
import { fiscal } from "@/features/fiscal/server/container";
import {
  emitirNfceDaVenda,
  processarOuEnfileirar,
  resumoDoDocumento,
} from "@/features/fiscal/server/emissao";
import { documentoDaLinha } from "@/features/fiscal/server/infra/prisma-documentos";
import { provedorSimuladoAtivo } from "@/features/fiscal/server/infra/provedores";
import prisma from "@/lib/db";
import {
  exigirAcessoTotal,
  fiscalProcedure,
  resumoSchema,
  traduzirErroFiscal,
} from "./_shared";
import { gestaoFiscalRoutes } from "./gestao";

/**
 * A empresa consegue emitir NFC-e agora? O PDV só oferece a nota quando sim —
 * nunca mais um "Gerar nota" que não faz nada.
 */
const situacao = fiscalProcedure
  .input(z.object({}).optional())
  .output(
    z.object({
      podeEmitir: z.boolean(),
      motivo: z.string().nullable(),
      ambiente: z.enum(["HOMOLOGACAO", "PRODUCAO"]).nullable(),
      simulado: z.boolean(),
    }),
  )
  .handler(async ({ context }) => {
    const config = await prisma.fiscalConfig.findUnique({
      where: { organizationId: context.org.id },
      select: {
        environment: true,
        taxRegime: true,
        cnpj: true,
        ie: true,
        focusToken: true,
        focusTokenHomolog: true,
      },
    });
    const simulado = provedorSimuladoAtivo();
    const ambiente = config?.environment ?? null;
    const falta = !config
      ? "Emissão fiscal não configurada"
      : !config.taxRegime
        ? "Regime tributário não informado"
        : config.taxRegime !== "SIMPLES_NACIONAL" &&
            config.taxRegime !== "SIMPLES_MEI"
          ? "Emissão disponível por enquanto só para Simples Nacional e MEI"
          : !config.cnpj || !config.ie
            ? "CNPJ ou Inscrição Estadual não informados"
            : !simulado &&
                !(config.environment === "PRODUCAO"
                  ? config.focusToken
                  : config.focusTokenHomolog)
              ? "Token da Focus não configurado para o ambiente atual"
              : null;
    return { podeEmitir: !falta, motivo: falta, ambiente, simulado };
  });

const emitirNfce = fiscalProcedure
  .input(
    z.object({
      saleId: z.string(),
      // "CPF na nota": ausente = usar o cliente da venda; vazio = sem CPF.
      cpfCnpj: z.string().optional(),
    }),
  )
  .output(resumoSchema)
  .handler(async ({ input, context, errors }) => {
    const documento =
      input.cpfCnpj === undefined ? undefined : somenteDigitos(input.cpfCnpj);
    if (documento && !documentoValido(documento))
      throw errors.BAD_REQUEST({ message: "CPF/CNPJ inválido" });
    try {
      return await emitirNfceDaVenda({
        organizationId: context.org.id,
        saleId: input.saleId,
        destinatario:
          documento === undefined
            ? undefined
            : documento
              ? { documento }
              : null,
      });
    } catch (erro) {
      traduzirErroFiscal(erro, errors);
    }
  });

/** Polling da tela: o documento vigente da venda (ou o último, se cancelado). */
const daVenda = fiscalProcedure
  .input(z.object({ saleId: z.string() }))
  .output(resumoSchema.nullable())
  .handler(async ({ input, context }) => {
    const vigente = await fiscal.documentos.buscarVigenteDaVenda(
      context.org.id,
      input.saleId,
      65,
    );
    if (vigente) return resumoDoDocumento(vigente);
    // Sem vigente, mostra a última (cancelada/inutilizada): a tela precisa
    // dizer "cancelada", não voltar para "emitindo…".
    const ultima = await prisma.fiscalDocument.findFirst({
      where: {
        organizationId: context.org.id,
        saleId: input.saleId,
        type: "NFCE",
      },
      orderBy: { createdAt: "desc" },
    });
    return ultima ? resumoDoDocumento(documentoDaLinha(ultima)) : null;
  });

/** "Tentar de novo" para documento parado (provedor caiu, fila indisponível). */
const tentarNovamente = fiscalProcedure
  .input(z.object({ documentoId: z.string() }))
  .output(resumoSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      return await processarOuEnfileirar(context.org.id, input.documentoId);
    } catch (erro) {
      traduzirErroFiscal(erro, errors);
    }
  });

/** Depois de corrigir o cadastro: reabre a rejeitada e transmite de novo. */
const reenviar = fiscalProcedure
  .input(z.object({ documentoId: z.string() }))
  .output(resumoSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      await fiscal.reenviarRejeitado.executar({
        organizationId: context.org.id,
        documentoId: input.documentoId,
      });
      return await processarOuEnfileirar(context.org.id, input.documentoId);
    } catch (erro) {
      traduzirErroFiscal(erro, errors);
    }
  });

/**
 * Cancelamento — só owner/admin. Na NFC-e o prazo é curto (30 minutos);
 * fora dele o caso de uso recusa antes de ir à SEFAZ.
 */
const cancelar = fiscalProcedure
  .input(
    z.object({
      documentoId: z.string(),
      justificativa: z.string(),
    }),
  )
  .output(resumoSchema)
  .handler(async ({ input, context, errors }) => {
    await exigirAcessoTotal(
      context.org.id,
      context.user.id,
      "cancelam nota fiscal",
      errors,
    );
    try {
      DocumentoFiscal.validarJustificativa(input.justificativa);
      await fiscal.cancelar.executar({
        organizationId: context.org.id,
        documentoId: input.documentoId,
        justificativa: input.justificativa,
      });
      const documento = await fiscal.documentos.buscarPorId(
        context.org.id,
        input.documentoId,
      );
      if (!documento)
        throw errors.NOT_FOUND({ message: "Documento fiscal não encontrado" });
      return resumoDoDocumento(documento);
    } catch (erro) {
      traduzirErroFiscal(erro, errors);
    }
  });

export const fiscalRoutes = {
  situacao,
  emitirNfce,
  daVenda,
  tentarNovamente,
  reenviar,
  cancelar,
  ...gestaoFiscalRoutes,
};
