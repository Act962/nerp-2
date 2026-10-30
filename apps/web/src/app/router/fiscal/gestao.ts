import { z } from "zod";
import { fiscal } from "@/features/fiscal/server/container";
import {
  alertasDaOrganizacao,
  listarNotas,
  situacaoDaNumeracao,
} from "@/features/fiscal/server/consultas";
import prisma from "@/lib/db";
import {
  exigirAcessoTotal,
  fiscalProcedure,
  statusSchema,
  traduzirErroFiscal,
} from "./_shared";

/**
 * Operação do dia a dia fiscal (Fase 3): a tela de notas emitidas, a
 * numeração da série com os números pulados e os alertas.
 */

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

const notaListadaSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  saleNumber: z.number(),
  status: statusSchema,
  ambiente: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
  serie: z.number(),
  numero: z.number(),
  chave: z.string().nullable(),
  protocolo: z.string().nullable(),
  criadoEm: z.string(),
  autorizadoEm: z.string().nullable(),
  totalCentavos: z.number(),
  destinatario: z.string().nullable(),
  rejeicao: z.object({ codigo: z.string(), motivo: z.string() }).nullable(),
  cancelamento: z
    .object({ justificativa: z.string(), canceladoEm: z.string() })
    .nullable(),
  cancelavelAte: z.string().nullable(),
  temXml: z.boolean(),
  temXmlCancelamento: z.boolean(),
  tentativas: z.number(),
});

const listar = fiscalProcedure
  .input(
    z.object({
      status: statusSchema.optional(),
      de: dia,
      ate: dia,
      numero: z.number().int().positive().optional(),
      cursor: z.string().optional(),
    }),
  )
  .output(
    z.object({
      itens: z.array(notaListadaSchema),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { itens, nextCursor } = await listarNotas({
      organizationId: context.org.id,
      ...input,
    });
    return {
      nextCursor,
      itens: itens.map((d) => ({
        id: d.id,
        saleId: d.saleId,
        saleNumber: d.saleNumber,
        status: d.status,
        ambiente: d.ambiente,
        serie: d.serie,
        numero: d.numero,
        chave: d.chave,
        protocolo: d.protocolo,
        criadoEm: d.criadoEm.toISOString(),
        autorizadoEm: d.autorizadoEm?.toISOString() ?? null,
        totalCentavos: d.totalCentavos,
        destinatario: d.nota?.destinatario?.documento ?? null,
        rejeicao: d.rejeicao,
        cancelamento: d.cancelamento
          ? {
              justificativa: d.cancelamento.justificativa,
              canceladoEm: d.cancelamento.canceladoEm.toISOString(),
            }
          : null,
        cancelavelAte: d.cancelavelAte?.toISOString() ?? null,
        temXml: Boolean(d.xmlKey),
        temXmlCancelamento: Boolean(d.xmlCancelamentoKey),
        tentativas: d.tentativas,
      })),
    };
  });

const faixaSchema = z.object({ inicio: z.number(), fim: z.number() });

const numeracao = fiscalProcedure
  .input(z.object({}).optional())
  .output(
    z.object({
      serie: z.number(),
      proximo: z.number().nullable(),
      pulados: z.array(faixaSchema),
      totalPulados: z.number(),
      inutilizacoes: z.array(
        z.object({
          id: z.string(),
          ambiente: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
          numeroInicial: z.number(),
          numeroFinal: z.number(),
          justificativa: z.string(),
          protocolo: z.string(),
          inutilizadaEm: z.string(),
          temXml: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const s = await situacaoDaNumeracao(context.org.id);
    return {
      ...s,
      inutilizacoes: s.inutilizacoes.map((i) => ({
        id: i.id,
        ambiente: i.ambiente,
        numeroInicial: i.numeroInicial,
        numeroFinal: i.numeroFinal,
        justificativa: i.justificativa,
        protocolo: i.protocolo,
        inutilizadaEm: i.inutilizadaEm.toISOString(),
        temXml: Boolean(i.xmlKey),
      })),
    };
  });

const inutilizar = fiscalProcedure
  .input(
    z.object({
      numeroInicial: z.number().int().positive(),
      numeroFinal: z.number().int().positive(),
      justificativa: z.string(),
    }),
  )
  .output(z.object({ id: z.string(), protocolo: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await exigirAcessoTotal(
      context.org.id,
      context.user.id,
      "inutilizam numeração",
      errors,
    );
    const config = await prisma.fiscalConfig.findUnique({
      where: { organizationId: context.org.id },
      select: { cnpj: true, environment: true, nfceSerie: true },
    });
    if (!config?.cnpj)
      throw errors.BAD_REQUEST({ message: "Emissão fiscal não configurada" });
    try {
      const r = await fiscal.inutilizar.executar({
        organizationId: context.org.id,
        modelo: 65,
        ambiente: config.environment,
        cnpj: config.cnpj,
        serie: config.nfceSerie ?? 1,
        ...input,
      });
      // Quem pediu fica registrado — o caso de uso não conhece usuário.
      await prisma.fiscalInutilizacao.updateMany({
        where: { id: r.id, organizationId: context.org.id },
        data: { createdById: context.user.id },
      });
      return { id: r.id, protocolo: r.protocolo };
    } catch (erro) {
      traduzirErroFiscal(erro, errors);
    }
  });

const alertas = fiscalProcedure
  .input(z.object({}).optional())
  .output(
    z.array(
      z.object({
        tipo: z.enum([
          "CERTIFICADO",
          "REJEICAO_RECORRENTE",
          "NOTAS_PARADAS",
          "NUMEROS_PULADOS",
          "TRIBUTOS_APROXIMADOS",
        ]),
        nivel: z.enum(["critico", "aviso", "info"]),
        mensagem: z.string(),
      }),
    ),
  )
  .handler(({ context }) => alertasDaOrganizacao(context.org.id));

export const gestaoFiscalRoutes = { listar, numeracao, inutilizar, alertas };
