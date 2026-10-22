import type { Alvo } from "../domain/alvos";
import type { ValorCru } from "../domain/converter";
import type { ResumoDaTabela, Tabela, TabelaRef } from "../domain/estrutura";
import type { Origem } from "../domain/mapeamento";

// Porta do banco de dados do cliente. Tudo o que a feature precisa de um banco
// externo passa por aqui — e só por aqui. Um motor novo (Postgres, SQL Server)
// é um adaptador novo que cumpre esta interface, mais uma linha em
// `server/compor.ts`; domínio, casos de uso e tela não mudam.
//
// Só verbos de leitura, de propósito: o banco é de produção e não é nosso.

export type MotorDeBanco = "oracle";

export interface DescricaoDaConexao {
  motor: MotorDeBanco;
  rotuloDoMotor: string;
  schemaPrincipal: string;
  /** host:porta/serviço — sem usuário nem senha. */
  servidor: string;
}

export interface PedidoDeAmostra {
  tabela: Tabela;
  /** Nomes canônicos, já conferidos contra `tabela`. */
  colunas: string[];
  filtro: { coluna: string; valor: string } | null;
  ordem: { coluna: string; direcao: "asc" | "desc" } | null;
  pagina: number;
  porPagina: number;
}

export interface Amostra {
  colunas: string[];
  linhas: Record<string, ValorCru>[];
  temMais: boolean;
  tempoMs: number;
}

export interface PedidoDeLeituraMapeada {
  alvo: Alvo;
  origem: Origem;
  base: Tabela;
  juncao: Tabela | null;
  limite: number;
  /** Restringe ao item pedido (o campo-chave do alvo), para testar um produto. */
  codigo: string | null;
  /** Encurta a janela de data — o teste não precisa de 90 dias de histórico. */
  diasNoMaximo: number | null;
  /**
   * Leitura completa em páginas: ordena pela `chave` do alvo e continua depois
   * destes valores (um por campo da chave). null = primeira página.
   */
  paginacao?: { depoisDe: ValorCru[] | null } | null;
}

export interface PedidoDePerfil {
  tabela: Tabela;
  /** Nome canônico, já conferido contra `tabela`. */
  coluna: string;
  /** Percentual de blocos lidos (amostragem); null = tabela inteira. */
  percentualDeBlocos: number | null;
  maisComuns: number;
  comFormatos: boolean;
}

export interface EstatisticasDaColuna {
  linhasAnalisadas: number;
  preenchidas: number;
  distintos: number;
  minimo: ValorCru;
  maximo: ValorCru;
  tamanhoMinimo: number | null;
  tamanhoMaximo: number | null;
  maisComuns: { valor: ValorCru; quantidade: number }[];
  /** Valor com dígito → 9 e letra → A/a: "99.999.999/9999-99" é CNPJ. */
  formatos: { formato: string; quantidade: number }[];
  tempoMs: number;
}

export interface ColunaEncontrada {
  tabela: TabelaRef;
  coluna: string;
  tipoNativo: string;
  comentario: string | null;
}

export interface BancoDeDadosPort {
  readonly descricao: DescricaoDaConexao;
  testarConexao(): Promise<void>;
  listarTabelas(): Promise<ResumoDaTabela[]>;
  /** null quando a tabela não existe ou a credencial não a enxerga. */
  descreverTabela(ref: TabelaRef): Promise<Tabela | null>;
  /** Todas as tabelas de um schema de uma vez (para o diagrama). */
  descreverSchema(schema: string): Promise<Tabela[]>;
  amostrar(pedido: PedidoDeAmostra): Promise<Amostra>;
  /** Estatística de UMA coluna — o que um humano faria olhando mil linhas. */
  perfilarColuna(pedido: PedidoDePerfil): Promise<EstatisticasDaColuna>;
  /** Colunas, em todas as tabelas visíveis, cujo nome ou comentário contém o termo. */
  buscarColunas(termo: string, limite: number): Promise<ColunaEncontrada[]>;
  /** Linhas com as chaves dos campos do NERP, ainda sem conversão. */
  lerMapeado(
    pedido: PedidoDeLeituraMapeada,
  ): Promise<Record<string, ValorCru>[]>;
  /** Descarta o que foi guardado da estrutura (tabela nova, grant novo). */
  esquecerEstrutura(): void;
  /** Erro do motor em português, sem expor detalhe do banco do cliente. */
  explicarFalha(erro: unknown): string;
}
