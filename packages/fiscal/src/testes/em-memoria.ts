import type {
  ArmazenamentoFiscal,
  ArquivoFiscal,
  GeradorDeId,
  Inutilizacao,
  MontadorDeNota,
  NumeracaoFiscal,
  ProvedorFiscal,
  ProvedoresFiscais,
  Relogio,
  RepositorioDocumentoFiscal,
  RepositorioInutilizacao,
  TipoArquivoFiscal,
  VendaParaNota,
} from "../aplicacao/portas";
import type { ModeloDocumento } from "../core/chave";
import {
  DocumentoFiscal,
  type DocumentoFiscalDados,
  STATUS_FORA_DE_VIGOR,
} from "../dominio/documento-fiscal";

/**
 * Adaptadores em memória das portas. Seguem as MESMAS regras que os reais
 * precisam seguir — inclusive o filtro por `organizationId`, para um teste de
 * caso de uso pegar vazamento entre empresas sem precisar de banco.
 */

export class RepositorioDocumentoFiscalEmMemoria
  implements RepositorioDocumentoFiscal
{
  readonly registros = new Map<string, DocumentoFiscalDados>();

  async buscarPorId(organizationId: string, id: string) {
    const dados = this.registros.get(id);
    if (!dados || dados.organizationId !== organizationId) return null;
    return DocumentoFiscal.restaurar(dados);
  }

  async buscarVigenteDaVenda(
    organizationId: string,
    saleId: string,
    modelo: ModeloDocumento,
  ) {
    for (const dados of this.registros.values())
      if (
        dados.organizationId === organizationId &&
        dados.saleId === saleId &&
        dados.modelo === modelo &&
        !STATUS_FORA_DE_VIGOR.includes(dados.status)
      )
        return DocumentoFiscal.restaurar(dados);
    return null;
  }

  async listarDaFaixa(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
    numeroInicial: number;
    numeroFinal: number;
  }) {
    return [...this.registros.values()]
      .filter(
        (d) =>
          d.organizationId === input.organizationId &&
          d.modelo === input.modelo &&
          d.serie === input.serie &&
          d.numero >= input.numeroInicial &&
          d.numero <= input.numeroFinal,
      )
      .map((d) => DocumentoFiscal.restaurar(d));
  }

  async salvar(documento: DocumentoFiscal) {
    this.registros.set(documento.id, documento.paraDados());
  }
}

export class RepositorioInutilizacaoEmMemoria
  implements RepositorioInutilizacao
{
  readonly registros: Inutilizacao[] = [];

  async salvar(inutilizacao: Inutilizacao) {
    this.registros.push({ ...inutilizacao });
  }

  async listarDaSerie(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }) {
    return this.registros.filter(
      (r) =>
        r.organizationId === input.organizationId &&
        r.modelo === input.modelo &&
        r.serie === input.serie,
    );
  }
}

export class NumeracaoFiscalEmMemoria implements NumeracaoFiscal {
  private readonly ultimos = new Map<string, number>();

  async reservar(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }) {
    const chave = `${input.organizationId}:${input.modelo}:${input.serie}`;
    const proximo = (this.ultimos.get(chave) ?? 0) + 1;
    this.ultimos.set(chave, proximo);
    return proximo;
  }

  async proximo(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }) {
    const ultimo = this.ultimos.get(
      `${input.organizationId}:${input.modelo}:${input.serie}`,
    );
    return ultimo === undefined ? null : ultimo + 1;
  }

  ultimo(
    organizationId: string,
    modelo: ModeloDocumento,
    serie: number,
  ): number {
    return this.ultimos.get(`${organizationId}:${modelo}:${serie}`) ?? 0;
  }
}

export class MontadorDeNotaEmMemoria implements MontadorDeNota {
  private readonly vendas = new Map<string, VendaParaNota>();

  definir(organizationId: string, saleId: string, venda: VendaParaNota): void {
    this.vendas.set(`${organizationId}:${saleId}`, venda);
  }

  async montar(input: {
    organizationId: string;
    saleId: string;
    modelo: ModeloDocumento;
  }) {
    return this.vendas.get(`${input.organizationId}:${input.saleId}`) ?? null;
  }
}

export class ArmazenamentoFiscalEmMemoria implements ArmazenamentoFiscal {
  readonly arquivos = new Map<string, ArquivoFiscal>();
  falhar = false;

  async guardar(input: {
    organizationId: string;
    documentoId: string;
    tipo: TipoArquivoFiscal;
    arquivo: ArquivoFiscal;
  }) {
    if (this.falhar) throw new Error("Bucket indisponível (simulação)");
    const extensao = input.tipo === "danfe" ? "pdf" : "xml";
    const key = `fiscal/${input.organizationId}/documentos/${input.documentoId}-${input.tipo}.${extensao}`;
    this.arquivos.set(key, input.arquivo);
    return key;
  }
}

export class ProvedoresFiscaisEmMemoria implements ProvedoresFiscais {
  private readonly porOrganizacao = new Map<string, ProvedorFiscal>();
  private readonly padrao: ProvedorFiscal;

  constructor(padrao: ProvedorFiscal) {
    this.padrao = padrao;
  }

  definir(organizationId: string, provedor: ProvedorFiscal): void {
    this.porOrganizacao.set(organizationId, provedor);
  }

  async daOrganizacao(organizationId: string) {
    return this.porOrganizacao.get(organizationId) ?? this.padrao;
  }
}

export class RelogioFixo implements Relogio {
  private atual: Date;

  constructor(inicio = new Date("2026-11-03T13:00:00.000Z")) {
    this.atual = inicio;
  }

  agora() {
    return new Date(this.atual);
  }

  avancar(ms: number): void {
    this.atual = new Date(this.atual.getTime() + ms);
  }
}

export class IdsSequenciais implements GeradorDeId {
  private contador = 0;

  gerar() {
    this.contador += 1;
    return `doc-${this.contador}`;
  }
}
