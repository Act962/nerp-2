import type { Conversao, TipoDoNerp } from "./alvos";
import type { ResumoDaTabela, TabelaRef } from "./estrutura";
import type { ColunaRef, Filtro, Origem } from "./mapeamento";

// Perfil automático: uma origem pronta para um ERP conhecido, escrita SEM
// schema — o schema muda de cliente para cliente (LGCARVALHO, ACME…), o nome
// das tabelas padrão não. O perfil vira origem quando as tabelas são achadas
// no banco da vez.

export interface PerfilAutomatico {
  chave: string;
  tipo: TipoDoNerp;
  rotulo: string;
  descricao: string;
  tabela: string;
  juncao?: { tabela: string; de: string; para: string };
  colunas: Record<string, ColunaRef>;
  conversoes?: Partial<Record<string, Conversao>>;
  filtros?: Filtro[];
  janela?: { coluna: ColunaRef; dias: number };
}

/**
 * Acha a tabela pelo nome, preferindo o schema principal: é lá que mora o
 * cadastro padrão, e um homônimo noutro schema (cópia, backup) não deve ganhar.
 */
export function localizarTabela(
  nome: string,
  tabelas: ResumoDaTabela[],
  schemaPrincipal: string,
): TabelaRef | null {
  const achadas = tabelas.filter((tabela) => tabela.nome === nome);
  if (achadas.length === 0) return null;
  const principal = achadas.find((tabela) => tabela.schema === schemaPrincipal);
  const escolhida = principal ?? achadas[0];
  return { schema: escolhida.schema, nome: escolhida.nome };
}

export type OrigemDoPerfil =
  | { ok: true; origem: Origem }
  | { ok: false; motivo: string };

/** Troca os nomes soltos do perfil pelas tabelas reais deste banco. */
export function origemDoPerfil(
  perfil: PerfilAutomatico,
  tabelas: ResumoDaTabela[],
  schemaPrincipal: string,
): OrigemDoPerfil {
  const base = localizarTabela(perfil.tabela, tabelas, schemaPrincipal);
  if (!base) {
    return { ok: false, motivo: semAcesso(perfil.tabela) };
  }
  let juncao: Origem["juncao"];
  if (perfil.juncao) {
    const tabela = localizarTabela(
      perfil.juncao.tabela,
      tabelas,
      schemaPrincipal,
    );
    if (!tabela) return { ok: false, motivo: semAcesso(perfil.juncao.tabela) };
    juncao = { tabela, de: perfil.juncao.de, para: perfil.juncao.para };
  }
  const conversoes: Record<string, Conversao> = {};
  for (const [campo, conversao] of Object.entries(perfil.conversoes ?? {})) {
    if (conversao) conversoes[campo] = conversao;
  }
  return {
    ok: true,
    origem: {
      tabela: base,
      juncao,
      colunas: perfil.colunas,
      conversoes,
      filtros: perfil.filtros ?? [],
      janela: perfil.janela,
    },
  };
}

function semAcesso(tabela: string): string {
  return `${tabela}: sem permissão (a tabela não aparece para esta credencial).`;
}
