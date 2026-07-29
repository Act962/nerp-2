import "server-only";
import type { TableInfo } from "./dictionary";

// Colunas mostradas no detalhamento (drill-down) de cada tabela.
//
// Curado porque as tabelas do Winthor têm de 400 a 800 colunas — listar tudo
// seria ilegível. A escolha prioriza IDENTIFICAR e CONTATAR o registro, que é
// o que a pessoa quer quando clica em "1.490 clientes": nome, telefone,
// e-mail, cidade.
//
// Nome que não existir no schema do cliente é descartado em silêncio (Winthor
// varia entre versões), e tabela sem perfil cai no fallback.

interface DetailColumnDef {
  column: string;
  label: string;
}

const PROFILES: Record<string, DetailColumnDef[]> = {
  PCCLIENT: [
    { column: "CODCLI", label: "Código" },
    { column: "CLIENTE", label: "Razão social" },
    { column: "FANTASIA", label: "Nome fantasia" },
    { column: "CGCENT", label: "CNPJ/CPF" },
    { column: "TELCOM", label: "Telefone" },
    { column: "TELCELENT", label: "Celular" },
    { column: "EMAIL", label: "E-mail" },
    { column: "MUNICENT", label: "Cidade" },
    { column: "ESTENT", label: "UF" },
    { column: "DTULTCOMP", label: "Última compra" },
  ],
  PCPEDC: [
    { column: "NUMPED", label: "Pedido" },
    { column: "DATA", label: "Data" },
    { column: "CODCLI", label: "Cliente" },
    { column: "CODUSUR", label: "Vendedor" },
    { column: "CODFILIAL", label: "Filial" },
    { column: "POSICAO", label: "Situação" },
    { column: "VLTOTAL", label: "Valor" },
  ],
  PCPEDI: [
    { column: "NUMPED", label: "Pedido" },
    { column: "DATA", label: "Data" },
    { column: "CODPROD", label: "Produto" },
    { column: "QT", label: "Quantidade" },
    { column: "CODCLI", label: "Cliente" },
  ],
  PCPRODUT: [
    { column: "CODPROD", label: "Código" },
    { column: "DESCRICAO", label: "Descrição" },
    // Sem DTVENC aqui, clicar num card de "produtos vencendo" listaria os
    // produtos SEM mostrar quando vencem — que é justamente o que se quer ver.
    { column: "DTVENC", label: "Vencimento" },
    { column: "CODMARCA", label: "Marca" },
    { column: "CODEPTO", label: "Departamento" },
    { column: "CODSEC", label: "Seção" },
    { column: "CODFORNEC", label: "Fornecedor" },
  ],
  PCUSUARI: [
    { column: "CODUSUR", label: "Código" },
    { column: "NOME", label: "Vendedor" },
    { column: "CODSUPERVISOR", label: "Supervisor" },
    { column: "CODFILIAL", label: "Filial" },
    { column: "DTULTVENDA", label: "Última venda" },
  ],
  PCFORNEC: [
    { column: "CODFORNEC", label: "Código" },
    { column: "FORNECEDOR", label: "Fornecedor" },
    { column: "FANTASIA", label: "Nome fantasia" },
    { column: "CGC", label: "CNPJ" },
    { column: "TELEFONECOM", label: "Telefone" },
    { column: "TELREP", label: "Tel. representante" },
    { column: "EMAIL", label: "E-mail" },
    { column: "MUNICOB", label: "Cidade" },
    { column: "ESTADO", label: "UF" },
  ],
  PCMOV: [
    { column: "DTMOV", label: "Data" },
    { column: "CODPROD", label: "Produto" },
    { column: "CODFILIAL", label: "Filial" },
    { column: "QT", label: "Quantidade" },
    { column: "CODCLI", label: "Cliente" },
  ],
  PCSUPERV: [
    { column: "CODSUPERVISOR", label: "Código" },
    { column: "NOME", label: "Supervisor" },
  ],
  PCFILIAL: [
    { column: "CODIGO", label: "Código" },
    { column: "FANTASIA", label: "Nome fantasia" },
    { column: "RAZAOSOCIAL", label: "Razão social" },
  ],
};

/** Máximo de colunas do fallback — além disso a tabela fica ilegível. */
const FALLBACK_LIMIT = 8;

export interface ResolvedDetailColumn {
  name: string;
  label: string;
  numeric: boolean;
}

/**
 * Colunas de detalhe válidas para a tabela, já filtradas contra o dicionário.
 * Sem perfil curado, usa as primeiras colunas da tabela — no Winthor as
 * identificadoras vêm primeiro na ordem física, então costuma ser útil.
 */
export function resolveDetailColumns(table: TableInfo): ResolvedDetailColumn[] {
  const profile = PROFILES[table.name];
  const chosen = profile
    ? profile.filter((entry) => table.columns.has(entry.column))
    : [...table.columns.values()]
        .slice(0, FALLBACK_LIMIT)
        .map((column) => ({ column: column.name, label: column.name }));

  return chosen.map((entry) => {
    const info = table.columns.get(entry.column);
    return {
      name: entry.column,
      label: entry.label,
      // Código de domínio (CODCLI…) é dimensão no dicionário mas deve alinhar
      // à esquerda como texto; só medida de verdade vai para a direita.
      numeric: info?.role === "measure",
    };
  });
}
