import "server-only";

import type {
  ArmazenamentoFiscal,
  ArquivoFiscal,
  TipoArquivoFiscal,
} from "@nerp/fiscal";
import { FISCAL_KEY_PREFIX, putFiscalObject } from "@/lib/fiscal/storage";

/**
 * XML e DANFCe vão para o bucket fiscal PRIVADO, nunca o de imagens. A key
 * começa com o id da organização, que é o que `belongsToOrg` confere antes de
 * qualquer leitura.
 */
export class ArmazenamentoFiscalR2 implements ArmazenamentoFiscal {
  async guardar(input: {
    organizationId: string;
    documentoId: string;
    tipo: TipoArquivoFiscal;
    arquivo: ArquivoFiscal;
  }): Promise<string> {
    const extensao =
      input.arquivo.contentType === "application/xml" ? "xml" : "pdf";
    const pasta =
      input.tipo === "xml-inutilizacao" ? "inutilizacoes" : "documentos";
    const key = `${FISCAL_KEY_PREFIX}${input.organizationId}/${pasta}/${input.documentoId}-${input.tipo}.${extensao}`;
    await putFiscalObject(
      key,
      Buffer.from(input.arquivo.bytes),
      input.arquivo.contentType,
    );
    return key;
  }
}
