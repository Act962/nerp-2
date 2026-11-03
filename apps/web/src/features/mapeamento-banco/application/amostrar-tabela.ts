import {
  type TabelaRef,
  acharColuna,
  podeFiltrarOuOrdenarPor,
} from "../domain/estrutura";
import type { Amostra } from "../ports/banco";
import {
  type Dependencias,
  LeituraRecusada,
  TabelaNaoEncontrada,
} from "./dependencias";

export const LINHAS_POR_PAGINA = 50;
/** Paginar fundo sem ordem por índice faz o banco pular milhares de linhas. */
export const PAGINA_MAXIMA = 19;

export interface PedidoDeAmostraDaTela {
  tabela: TabelaRef;
  colunas?: string[];
  filtro?: { coluna: string; valor: string } | null;
  ordem?: { coluna: string; direcao: "asc" | "desc" } | null;
  pagina: number;
}

/**
 * Primeiras linhas de uma tabela, para conhecer o dado. Coluna binária fica de
 * fora (não tem como exibir), e filtro/ordem passam pela mesma regra de tabela
 * grande do resto da feature.
 */
export async function amostrarTabela(
  deps: Dependencias,
  pedido: PedidoDeAmostraDaTela,
): Promise<Amostra> {
  const tabela = await deps.banco.descreverTabela(pedido.tabela);
  if (!tabela) throw new TabelaNaoEncontrada(pedido.tabela.nome);

  const exibiveis = tabela.colunas.filter((coluna) => coluna.tipo !== "outro");
  const pedidas = pedido.colunas?.length
    ? exibiveis.filter((coluna) => pedido.colunas?.includes(coluna.nome))
    : exibiveis;
  if (pedidas.length === 0) {
    throw new LeituraRecusada("Nenhuma coluna exibível nesta tabela.");
  }

  const filtro = pedido.filtro?.valor.trim() ? pedido.filtro : null;
  for (const nome of [filtro?.coluna, pedido.ordem?.coluna]) {
    if (!nome) continue;
    if (acharColuna(tabela, nome)?.tipo === "outro") {
      throw new LeituraRecusada(`${nome} é binária e não serve para filtrar.`);
    }
    const liberacao = podeFiltrarOuOrdenarPor(tabela, nome);
    if (!liberacao.ok) throw new LeituraRecusada(liberacao.motivo);
  }
  if (filtro) {
    const coluna = acharColuna(tabela, filtro.coluna);
    const valor = filtro.valor.trim();
    if (
      coluna?.tipo === "numero" &&
      !Number.isFinite(Number(valor.replace(",", ".")))
    ) {
      throw new LeituraRecusada(
        `${coluna.nome} é numérica: informe um número.`,
      );
    }
    if (coluna?.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      throw new LeituraRecusada(
        `${coluna.nome} é data: use o formato AAAA-MM-DD.`,
      );
    }
  }
  if (pedido.pagina > PAGINA_MAXIMA) {
    throw new LeituraRecusada(
      "A amostra vai até 1.000 linhas. Use um filtro para chegar ao dado.",
    );
  }

  return deps.banco.amostrar({
    tabela,
    colunas: pedidas.map((coluna) => coluna.nome),
    filtro: filtro
      ? { coluna: filtro.coluna, valor: filtro.valor.trim() }
      : null,
    ordem: pedido.ordem ?? null,
    pagina: Math.max(0, pedido.pagina),
    porPagina: LINHAS_POR_PAGINA,
  });
}
