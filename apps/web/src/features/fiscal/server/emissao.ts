import "server-only";

import {
  type Destinatario,
  type DocumentoFiscal,
  type Emitente,
  ErroFiscal,
  ProvedorIndisponivelError,
  calcularTotais,
} from "@nerp/fiscal";
import { NonRetriableError } from "inngest";
import { fiscalEmissaoSolicitada, inngest } from "@/lib/inngest/client";
import { formatCNPJ } from "@/utils/format-cnpj";
import { fiscal } from "./container";

/**
 * Orquestra a emissão fora dos casos de uso: tentativa imediata + fila.
 *
 * A NFC-e na Focus é síncrona e costuma voltar em 1–3 s. Então a procedure já
 * tenta transmitir na hora — o caixa vê "autorizada" sem esperar fila. Se o
 * provedor estiver fora, ou a SEFAZ demorar, o documento vai para o job
 * `fiscal-emit`, que repete com segurança (a `ref` impede nota dupla).
 */

export type ResumoDocumentoFiscal = ReturnType<typeof resumoDoDocumento>;

export function resumoDoDocumento(d: DocumentoFiscal) {
  const dados = d.paraDados();
  const tributos = calcularTotais(dados.nota).tributosAproximados;
  return {
    id: dados.id,
    saleId: dados.saleId,
    status: dados.status,
    ambiente: dados.ambiente,
    serie: dados.serie,
    numero: dados.numero,
    chave: dados.chave,
    protocolo: dados.protocolo,
    autorizadoEm: dados.autorizadoEm?.toISOString() ?? null,
    qrCodeUrl: dados.qrCodeUrl,
    consultaUrl: dados.consultaUrl,
    rejeicao: dados.rejeicao,
    destinatario: dados.nota.destinatario?.documento ?? null,
    tentativas: dados.tentativas,
    canceladoEm: dados.cancelamento?.canceladoEm.toISOString() ?? null,
    cancelavelAte: d.cancelavelAte?.toISOString() ?? null,
    temXml: Boolean(dados.xmlKey),
    temXmlCancelamento: Boolean(dados.xmlCancelamentoKey),
    // O DANFE imprime o emitente e os tributos da nota como foram emitidos,
    // não da configuração atual — trocar o endereço depois não muda cupom velho.
    emitente: emitenteDoDanfe(dados.nota.emitente),
    tributosAproximados: tributos != null ? tributos / 100 : null,
  };
}

function emitenteDoDanfe(e: Emitente) {
  const { endereco: end } = e;
  const partes = [
    end.logradouro,
    end.numero,
    end.complemento,
    end.bairro,
  ].filter(Boolean);
  return {
    razaoSocial: e.razaoSocial,
    cnpj: formatCNPJ(e.cnpj),
    inscricaoEstadual: e.inscricaoEstadual,
    endereco: `${partes.join(", ")} – ${end.municipio}/${end.uf}`,
  };
}

/**
 * Cancela a NFC-e vigente de uma venda, se houver uma autorizada. É a porta
 * para o futuro cancelamento de venda do PDV (que hoje não existe: estornar
 * estoque, caixa e financeiro é outra spec) — quem cancelar a venda chama
 * isto ANTES de estornar, porque a recusa da SEFAZ (fora do prazo) deve
 * impedir o cancelamento da venda, e não o contrário.
 */
export async function cancelarNotaDaVenda(input: {
  organizationId: string;
  saleId: string;
  justificativa: string;
}): Promise<ResumoDocumentoFiscal | null> {
  const vigente = await fiscal.documentos.buscarVigenteDaVenda(
    input.organizationId,
    input.saleId,
    65,
  );
  if (!vigente || vigente.status !== "AUTHORIZED") return null;
  await fiscal.cancelar.executar({
    organizationId: input.organizationId,
    documentoId: vigente.id,
    justificativa: input.justificativa,
  });
  const cancelado = await fiscal.documentos.buscarPorId(
    input.organizationId,
    vigente.id,
  );
  return cancelado ? resumoDoDocumento(cancelado) : null;
}

export async function enfileirarEmissao(
  organizationId: string,
  documentoId: string,
): Promise<void> {
  try {
    await inngest.send(
      fiscalEmissaoSolicitada.create({ organizationId, documentoId }),
    );
  } catch (erro) {
    // Sem fila (ex.: dev sem `pnpm inngest:dev`) o documento fica PENDING e a
    // tela oferece "tentar de novo" — não derruba a venda já concluída.
    console.error("[fiscal] não foi possível enfileirar a emissão:", erro);
  }
}

/** Uma tentativa já, sem deixar queda do provedor virar erro para o caixa. */
async function tentarAgora(organizationId: string, documentoId: string) {
  try {
    return await fiscal.processarEmissao.executar({
      organizationId,
      documentoId,
    });
  } catch (erro) {
    if (erro instanceof ProvedorIndisponivelError) return null;
    throw erro;
  }
}

export async function emitirNfceDaVenda(input: {
  organizationId: string;
  saleId: string;
  destinatario?: Destinatario | null;
}): Promise<ResumoDocumentoFiscal> {
  let solicitado: Awaited<
    ReturnType<typeof fiscal.solicitarEmissaoNfce.executar>
  >;
  try {
    solicitado = await fiscal.solicitarEmissaoNfce.executar(input);
  } catch (erro) {
    // Dois cliques simultâneos: o índice parcial "um vigente por venda" barra
    // o segundo INSERT. Repetir devolve o documento que o primeiro criou.
    if ((erro as { code?: string }).code === "P2002")
      solicitado = await fiscal.solicitarEmissaoNfce.executar(input);
    else throw erro;
  }

  const resultado = await processarOuEnfileirar(
    input.organizationId,
    solicitado.documentoId,
  );
  return resultado;
}

/** Tenta agora; se não decidiu, manda para o job. Devolve o estado atual. */
export async function processarOuEnfileirar(
  organizationId: string,
  documentoId: string,
): Promise<ResumoDocumentoFiscal> {
  const tentativa = await tentarAgora(organizationId, documentoId);
  if (!tentativa || tentativa.consultarNovamente)
    await enfileirarEmissao(organizationId, documentoId);

  const documento = await fiscal.documentos.buscarPorId(
    organizationId,
    documentoId,
  );
  if (!documento)
    throw new ErroFiscal(
      "DOCUMENTO_NAO_ENCONTRADO",
      "Documento fiscal não encontrado",
    );
  return resumoDoDocumento(documento);
}

/** Corpo do job: erro de configuração não adianta repetir. */
export async function processarEmissaoNoJob(
  organizationId: string,
  documentoId: string,
) {
  try {
    return await fiscal.processarEmissao.executar({
      organizationId,
      documentoId,
    });
  } catch (erro) {
    if (
      erro instanceof ErroFiscal &&
      !(erro instanceof ProvedorIndisponivelError)
    )
      throw new NonRetriableError(erro.message, { cause: erro });
    throw erro;
  }
}
