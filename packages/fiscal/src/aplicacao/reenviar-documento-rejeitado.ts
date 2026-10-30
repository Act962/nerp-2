import {
  CadastroFiscalIncompletoError,
  DocumentoNaoEncontradoError,
  VendaNaoEncontradaError,
} from "../dominio/erros";
import { validarNotaParaEmissao } from "../dominio/validacao";
import type { MontadorDeNota, RepositorioDocumentoFiscal } from "./portas";

export type ReenviarDocumentoRejeitadoDeps = {
  documentos: RepositorioDocumentoFiscal;
  montador: MontadorDeNota;
};

/**
 * Depois que o operador corrige o cadastro (ex.: o NCM que a SEFAZ recusou),
 * remonta a nota a partir da venda e devolve o documento à fila com o mesmo
 * número. Quem transmite de novo é `ProcessarEmissao`.
 */
export class ReenviarDocumentoRejeitado {
  private readonly deps: ReenviarDocumentoRejeitadoDeps;

  constructor(deps: ReenviarDocumentoRejeitadoDeps) {
    this.deps = deps;
  }

  async executar(input: {
    organizationId: string;
    documentoId: string;
  }): Promise<void> {
    const { documentos, montador } = this.deps;

    const documento = await documentos.buscarPorId(
      input.organizationId,
      input.documentoId,
    );
    if (!documento) throw new DocumentoNaoEncontradoError();
    documento.exigirPermite("PENDING", "reenvio");

    const venda = await montador.montar({
      organizationId: input.organizationId,
      saleId: documento.saleId,
      modelo: documento.modelo,
      // O CPF informado no caixa não está na venda: vem da nota original.
      destinatario: documento.nota.destinatario ?? null,
    });
    if (!venda) throw new VendaNaoEncontradaError();

    const pendencias = validarNotaParaEmissao(venda.nota);
    if (pendencias.length > 0)
      throw new CadastroFiscalIncompletoError(pendencias);

    documento.reabrirParaReenvio(venda.nota);
    await documentos.salvar(documento);
  }
}
