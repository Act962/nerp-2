import type {
  AcaoDeCliente,
  AcaoDeProduto,
  ClienteLocal,
  ProdutoLocal,
  RegistroDeEstoque,
} from "../domain/importacao";

// Porta do NERP para a importação: o que já existe no cadastro da organização
// e como gravar o que as regras (`domain/importacao.ts`) decidiram. As regras
// não sabem de Prisma; o adaptador não decide nada — só executa.

export interface ResultadoDaGravacao {
  gravados: number;
  falhas: { codigo: string; motivo: string }[];
}

export interface DestinoNoNerpPort {
  produtosLocais(): Promise<ProdutoLocal[]>;
  aplicarProdutos(acoes: AcaoDeProduto[]): Promise<ResultadoDaGravacao>;
  clientesLocais(): Promise<ClienteLocal[]>;
  aplicarClientes(acoes: AcaoDeCliente[]): Promise<ResultadoDaGravacao>;
  /** Código do ERP → id do produto no NERP. */
  produtosVinculados(): Promise<Map<string, string>>;
  /** Filial cujo disponível vira o estoque do produto (tela e vitrine). */
  filialDoEstoque(): Promise<string | null>;
  /** Troca o espelho de estoque inteiro, numa transação. */
  substituirEstoque(
    registros: RegistroDeEstoque[],
  ): Promise<{ produtosAtualizados: number }>;
}
