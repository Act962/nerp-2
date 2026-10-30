import "server-only";

import { randomUUID } from "node:crypto";
import {
  CancelarDocumentoFiscal,
  InutilizarNumeracao,
  ProcessarEmissao,
  ReenviarDocumentoRejeitado,
  SolicitarEmissaoNfce,
} from "@nerp/fiscal";
import { ArmazenamentoFiscalEmMemoria } from "@nerp/fiscal/testes";
import { getFiscalObject } from "@/lib/fiscal/storage";
import { MontadorDeNotaPrisma } from "./infra/prisma-montador";
import { RepositorioDocumentoFiscalPrisma } from "./infra/prisma-documentos";
import { RepositorioInutilizacaoPrisma } from "./infra/prisma-inutilizacoes";
import { NumeracaoFiscalPrisma } from "./infra/prisma-numeracao";
import {
  ProvedoresFiscaisDoBanco,
  provedorSimuladoAtivo,
} from "./infra/provedores";
import { ArmazenamentoFiscalR2 } from "./infra/r2-armazenamento";

/**
 * Raiz de composição: liga os casos de uso de `@nerp/fiscal` aos adaptadores
 * reais. Procedures e o job do Inngest pegam os casos de uso daqui — nenhum
 * deles instancia Prisma, Focus ou R2 por conta própria.
 */
const documentos = new RepositorioDocumentoFiscalPrisma();
const montador = new MontadorDeNotaPrisma();
const numeracao = new NumeracaoFiscalPrisma();
const inutilizacoes = new RepositorioInutilizacaoPrisma();
const provedores = new ProvedoresFiscaisDoBanco();
// No modo simulado o XML de mentira não vai para o bucket (que pode nem
// existir no ambiente de quem está testando). Fica no `globalThis` porque, em
// dev, a rota de download e a do oRPC podem carregar cada uma a sua cópia
// deste módulo — e precisam enxergar o mesmo "bucket".
const globalFiscal = globalThis as {
  nerpFiscalEmMemoria?: ArmazenamentoFiscalEmMemoria;
};
if (provedorSimuladoAtivo() && !globalFiscal.nerpFiscalEmMemoria)
  globalFiscal.nerpFiscalEmMemoria = new ArmazenamentoFiscalEmMemoria();
const emMemoria = provedorSimuladoAtivo()
  ? (globalFiscal.nerpFiscalEmMemoria ?? null)
  : null;
const armazenamento = emMemoria ?? new ArmazenamentoFiscalR2();

/**
 * Lê um arquivo guardado por `armazenamento`. No modo simulado ele vive na
 * memória do processo (some ao reiniciar o servidor) — `null` se não estiver.
 */
export async function lerArquivoFiscal(key: string): Promise<Buffer | null> {
  if (emMemoria) {
    const arquivo = emMemoria.arquivos.get(key);
    return arquivo ? Buffer.from(arquivo.bytes) : null;
  }
  try {
    return await getFiscalObject(key);
  } catch (erro) {
    console.error("[fiscal] arquivo indisponível no bucket:", key, erro);
    return null;
  }
}
const relogio = { agora: () => new Date() };
const ids = { gerar: () => randomUUID() };

export const fiscal = {
  solicitarEmissaoNfce: new SolicitarEmissaoNfce({
    documentos,
    montador,
    numeracao,
    relogio,
    ids,
  }),
  processarEmissao: new ProcessarEmissao({
    documentos,
    provedores,
    armazenamento,
    relogio,
  }),
  reenviarRejeitado: new ReenviarDocumentoRejeitado({ documentos, montador }),
  cancelar: new CancelarDocumentoFiscal({
    documentos,
    provedores,
    armazenamento,
    relogio,
  }),
  inutilizar: new InutilizarNumeracao({
    documentos,
    inutilizacoes,
    numeracao,
    provedores,
    armazenamento,
    relogio,
    ids,
  }),
  documentos,
  inutilizacoes,
  numeracao,
};
