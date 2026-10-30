/**
 * Tabelas oficiais usadas no cadastro fiscal, com a descrição que o operador
 * lê no select. São recortes: entram os códigos que um varejo usa, não a
 * tabela inteira de cada anexo.
 *
 * As descrições são curtas de propósito — servem para reconhecer o código, não
 * substituem a orientação do contador.
 */

export type ItemTabela = { codigo: string; descricao: string };

export const ORIGENS: readonly ItemTabela[] = [
  { codigo: "0", descricao: "Nacional" },
  { codigo: "1", descricao: "Estrangeira — importação direta" },
  { codigo: "2", descricao: "Estrangeira — adquirida no mercado interno" },
  { codigo: "3", descricao: "Nacional, conteúdo importado acima de 40%" },
  { codigo: "4", descricao: "Nacional, processos produtivos básicos" },
  { codigo: "5", descricao: "Nacional, conteúdo importado até 40%" },
  { codigo: "6", descricao: "Estrangeira, importação direta sem similar" },
  { codigo: "7", descricao: "Estrangeira, mercado interno sem similar" },
  { codigo: "8", descricao: "Nacional, conteúdo importado acima de 70%" },
];

/** ICMS no Simples Nacional e MEI (CRT 1 e 4). */
export const CSOSN: readonly ItemTabela[] = [
  { codigo: "101", descricao: "Tributada com permissão de crédito" },
  { codigo: "102", descricao: "Tributada sem permissão de crédito" },
  { codigo: "103", descricao: "Isenção do ICMS para faixa de receita" },
  { codigo: "201", descricao: "Com crédito e cobrança do ICMS por ST" },
  { codigo: "202", descricao: "Sem crédito e com cobrança do ICMS por ST" },
  {
    codigo: "203",
    descricao: "Isenção para faixa de receita e cobrança por ST",
  },
  { codigo: "300", descricao: "Imune" },
  { codigo: "400", descricao: "Não tributada" },
  { codigo: "500", descricao: "ICMS já cobrado por ST ou antecipação" },
  { codigo: "900", descricao: "Outros" },
];

/** ICMS no Regime Normal (CRT 3). */
export const CST_ICMS: readonly ItemTabela[] = [
  { codigo: "00", descricao: "Tributada integralmente" },
  { codigo: "02", descricao: "Tributação monofásica própria (combustíveis)" },
  { codigo: "10", descricao: "Tributada e com cobrança do ICMS por ST" },
  {
    codigo: "15",
    descricao: "Monofásica própria e com retenção (combustíveis)",
  },
  { codigo: "20", descricao: "Com redução de base de cálculo" },
  { codigo: "30", descricao: "Isenta ou não tributada, com cobrança por ST" },
  { codigo: "40", descricao: "Isenta" },
  { codigo: "41", descricao: "Não tributada" },
  { codigo: "50", descricao: "Suspensão" },
  { codigo: "51", descricao: "Diferimento" },
  { codigo: "53", descricao: "Monofásica com recolhimento diferido" },
  { codigo: "60", descricao: "ICMS cobrado anteriormente por ST" },
  { codigo: "61", descricao: "Monofásica cobrada anteriormente" },
  { codigo: "70", descricao: "Redução de base e cobrança por ST" },
  { codigo: "90", descricao: "Outras" },
];

/** PIS e COFINS de saída — mesma tabela para os dois. */
export const CST_PIS_COFINS: readonly ItemTabela[] = [
  { codigo: "01", descricao: "Tributável — alíquota básica" },
  { codigo: "02", descricao: "Tributável — alíquota diferenciada" },
  { codigo: "03", descricao: "Tributável — alíquota por unidade" },
  { codigo: "04", descricao: "Monofásica — revenda a alíquota zero" },
  { codigo: "05", descricao: "Substituição tributária" },
  { codigo: "06", descricao: "Alíquota zero" },
  { codigo: "07", descricao: "Isenta" },
  { codigo: "08", descricao: "Sem incidência" },
  { codigo: "09", descricao: "Suspensão" },
  { codigo: "49", descricao: "Outras operações de saída" },
  { codigo: "99", descricao: "Outras operações" },
];

/**
 * Validação de CST de PIS/COFINS aceita a tabela oficial inteira, não só o
 * recorte do select: o contador pode precisar de um código que não listamos.
 */
export const CST_PIS_COFINS_VALIDO = /^(0[1-9]|49|5[0-6]|6[0-7]|7[0-5]|98|99)$/;

/** CFOPs de saída mais comuns no varejo. NFC-e aceita só os 5xxx. */
export const CFOPS_VAREJO: readonly ItemTabela[] = [
  { codigo: "5101", descricao: "Venda de produção própria" },
  { codigo: "5102", descricao: "Venda de mercadoria de terceiros (revenda)" },
  { codigo: "5405", descricao: "Revenda com ICMS já retido por ST" },
  { codigo: "5656", descricao: "Venda de combustível ao consumidor final" },
  { codigo: "5933", descricao: "Prestação de serviço tributado pelo ISSQN" },
];

/** `indIEDest` — situação do cliente perante o ICMS (NF-e modelo 55). */
export const INDICADORES_IE: readonly ItemTabela[] = [
  { codigo: "1", descricao: "Contribuinte do ICMS (tem IE)" },
  { codigo: "2", descricao: "Contribuinte isento de IE" },
  { codigo: "9", descricao: "Não contribuinte" },
];

export const codigos = (tabela: readonly ItemTabela[]) =>
  new Set(tabela.map((i) => i.codigo));

export function descricaoDe(
  tabela: readonly ItemTabela[],
  codigo: string | null | undefined,
): string | null {
  return tabela.find((i) => i.codigo === codigo)?.descricao ?? null;
}
