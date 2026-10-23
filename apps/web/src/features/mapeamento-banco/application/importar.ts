import { ALVOS } from "../domain/alvos";
import {
  type ValorConvertido,
  type ValorCru,
  converterLinha,
} from "../domain/converter";
import {
  type AcaoDeCliente,
  type AcaoDeProduto,
  MOTIVOS,
  type ResumoDasAcoes,
  type TipoImportavel,
  planejarClientes,
  planejarEstoque,
  planejarProdutos,
  resumirAcoes,
} from "../domain/importacao";
import { type Dependencias, LeituraRecusada } from "./dependencias";
import { type ResolucaoDoTipo, resolverTipo } from "./resolver-tipo";

// Importação ERP → NERP pelo mapeamento salvo, em dois tempos:
// 1. `simularImportacao` lê TUDO e diz o que faria, sem gravar nada;
// 2. `importarLote` grava UMA página por chamada e devolve onde parou.
// Página por chamada porque são dezenas de milhares de linhas: nenhuma chamada
// fica longa, uma queda não perde o que já foi, e quem chama (o agente de IA,
// via MCP) só segue depois de ver a simulação.

/** Linhas por ida ao ERP na leitura completa. */
const PAGINA_DE_LEITURA = 5000;
/** Teto da leitura da simulação: acima disso o resumo avisa que é parcial. */
export const LIMITE_DA_SIMULACAO = 200_000;
export const LOTE_PADRAO = 1000;
export const LOTE_MAXIMO = 3000;

type Valores = Record<string, ValorConvertido>;

interface Pagina {
  linhas: Valores[];
  lidas: number;
  comErro: number;
  errosDeExemplo: { codigo: string | null; erros: string[] }[];
  proximo: ValorCru[] | null;
}

async function resolverParaImportar(
  deps: Dependencias,
  tipo: TipoImportavel,
): Promise<ResolucaoDoTipo> {
  const config = (await deps.repositorio.carregar()).tipos[tipo];
  const resolucao = await resolverTipo(deps, tipo, config);
  if (
    resolucao.status !== "pronto" ||
    !resolucao.origem ||
    !resolucao.estruturas
  ) {
    throw new LeituraRecusada(
      `O mapeamento de ${ALVOS[tipo].rotulo} não está pronto (${resolucao.status}): ${resolucao.diagnostico.erros.join(" ") || "ajuste e salve o mapeamento antes de importar."}`,
    );
  }
  return resolucao;
}

async function lerPagina(
  deps: Dependencias,
  tipo: TipoImportavel,
  resolucao: ResolucaoDoTipo,
  depoisDe: ValorCru[] | null,
  limite: number,
): Promise<Pagina> {
  const alvo = ALVOS[tipo];
  const origem = resolucao.origem;
  const estruturas = resolucao.estruturas;
  if (!origem || !estruturas)
    throw new LeituraRecusada("Mapeamento sem origem.");
  const cruas = await deps.banco.lerMapeado({
    alvo,
    origem,
    base: estruturas.base,
    juncao: estruturas.juncao,
    limite,
    codigo: null,
    diasNoMaximo: null,
    paginacao: { depoisDe },
  });
  const obrigatorios = new Set(
    alvo.campos
      .filter((campo) => campo.obrigatorio)
      .map((campo) => campo.rotulo),
  );
  const pagina: Pagina = {
    linhas: [],
    lidas: cruas.length,
    comErro: 0,
    errosDeExemplo: [],
    proximo: null,
  };
  for (const crua of cruas) {
    const { valores, erros } = converterLinha(alvo, crua, origem.conversoes);
    // Erro em campo obrigatório tira a linha; em opcional, o campo vai vazio.
    const grave = erros.some((erro) =>
      [...obrigatorios].some((rotulo) => erro.startsWith(`${rotulo}:`)),
    );
    if (grave) {
      pagina.comErro += 1;
      if (pagina.errosDeExemplo.length < 5) {
        const chave = valores[alvo.chave[0]];
        pagina.errosDeExemplo.push({
          codigo: chave === null || chave === undefined ? null : String(chave),
          erros,
        });
      }
      continue;
    }
    pagina.linhas.push(valores);
  }
  const ultima = cruas[cruas.length - 1];
  if (cruas.length === limite && ultima) {
    pagina.proximo = alvo.chave.map((campo) => ultima[campo] ?? null);
  }
  return pagina;
}

async function lerTudo(
  deps: Dependencias,
  tipo: TipoImportavel,
  resolucao: ResolucaoDoTipo,
): Promise<Pagina & { completo: boolean }> {
  const total: Pagina = {
    linhas: [],
    lidas: 0,
    comErro: 0,
    errosDeExemplo: [],
    proximo: null,
  };
  let depoisDe: ValorCru[] | null = null;
  do {
    const pagina = await lerPagina(
      deps,
      tipo,
      resolucao,
      depoisDe,
      PAGINA_DE_LEITURA,
    );
    total.linhas.push(...pagina.linhas);
    total.lidas += pagina.lidas;
    total.comErro += pagina.comErro;
    total.errosDeExemplo.push(
      ...pagina.errosDeExemplo.slice(0, 5 - total.errosDeExemplo.length),
    );
    depoisDe = pagina.proximo;
  } while (depoisDe && total.lidas < LIMITE_DA_SIMULACAO);
  return { ...total, completo: depoisDe === null };
}

function descreverProduto(acao: AcaoDeProduto | AcaoDeCliente): string {
  if (acao.acao === "criar")
    return `criaria "${"nome" in acao.dados ? acao.dados.nome : ""}"`;
  if (acao.acao === "atualizar") return `preencheria ${acao.campos.join(", ")}`;
  if (acao.acao === "ignorar") return MOTIVOS[acao.motivo];
  return "sem mudança";
}

/** Em exemplo de cliente, o documento sai mascarado: o resumo vai para a IA. */
function descreverCliente(acao: AcaoDeProduto | AcaoDeCliente): string {
  if (acao.acao === "criar" && "pessoa" in acao.dados) {
    const documento = acao.dados.documento
      ? `•••${acao.dados.documento.slice(-4)}`
      : "sem documento";
    return `criaria "${acao.dados.nome}" (${acao.dados.pessoa === "JURIDICA" ? "PJ" : "PF"}, ${documento})`;
  }
  return descreverProduto(acao);
}

export interface Simulacao {
  tipo: TipoImportavel;
  origem: string;
  lidas: number;
  comErro: number;
  errosDeExemplo: { codigo: string | null; erros: string[] }[];
  completo: boolean;
  resumo?: ResumoDasAcoes;
  estoque?: {
    registrosComDisponivel: number;
    semProdutoNoNerp: number;
    filiais: string[];
    filialDoEstoque: string | null;
    produtosComEstoqueNaFilial: number;
  };
}

function origemLegivel(resolucao: ResolucaoDoTipo): string {
  const origem = resolucao.origem;
  if (!origem) return "—";
  const tabelas = origem.juncao
    ? `${origem.tabela.nome} + ${origem.juncao.tabela.nome}`
    : origem.tabela.nome;
  return resolucao.perfil ? `${resolucao.perfil.rotulo}` : `manual: ${tabelas}`;
}

export async function simularImportacao(
  deps: Dependencias,
  tipo: TipoImportavel,
  opcoes: { criarFaltantes: boolean },
): Promise<Simulacao> {
  const resolucao = await resolverParaImportar(deps, tipo);
  const lido = await lerTudo(deps, tipo, resolucao);
  const base = {
    tipo,
    origem: origemLegivel(resolucao),
    lidas: lido.lidas,
    comErro: lido.comErro,
    errosDeExemplo: lido.errosDeExemplo,
    completo: lido.completo,
  };

  if (tipo === "estoque") {
    const [vinculados, filial] = await Promise.all([
      deps.destino.produtosVinculados(),
      deps.destino.filialDoEstoque(),
    ]);
    const plano = planejarEstoque(lido.linhas, vinculados);
    return {
      ...base,
      estoque: {
        registrosComDisponivel: plano.registros.length,
        semProdutoNoNerp: plano.semProduto,
        filiais: plano.filiais,
        filialDoEstoque: filial,
        produtosComEstoqueNaFilial: plano.registros.filter(
          (registro) => registro.filial === filial,
        ).length,
      },
    };
  }

  if (tipo === "produto") {
    const acoes = planejarProdutos(
      lido.linhas,
      await deps.destino.produtosLocais(),
      opcoes,
    );
    return { ...base, resumo: resumirAcoes(acoes, descreverProduto) };
  }
  const acoes = planejarClientes(
    lido.linhas,
    await deps.destino.clientesLocais(),
    opcoes,
  );
  return { ...base, resumo: resumirAcoes(acoes, descreverCliente) };
}

export interface ResultadoDoLote {
  tipo: TipoImportavel;
  lidas: number;
  comErro: number;
  resumo?: ResumoDasAcoes;
  gravados: number;
  falhas: { codigo: string; motivo: string }[];
  /** Passe de volta em `depoisDe` para continuar; null = acabou. */
  proximo: ValorCru[] | null;
  estoque?: {
    registros: number;
    semProdutoNoNerp: number;
    produtosAtualizados: number;
  };
}

export async function importarLote(
  deps: Dependencias,
  tipo: TipoImportavel,
  opcoes: {
    criarFaltantes: boolean;
    depoisDe: ValorCru[] | null;
    tamanho: number;
  },
): Promise<ResultadoDoLote> {
  const resolucao = await resolverParaImportar(deps, tipo);

  // Estoque é um retrato: troca o espelho inteiro numa transação, então lê
  // tudo de uma vez em vez de paginar entre chamadas.
  if (tipo === "estoque") {
    const lido = await lerTudo(deps, tipo, resolucao);
    if (!lido.completo) {
      throw new LeituraRecusada(
        `O estoque passou de ${LIMITE_DA_SIMULACAO} linhas; filtre o mapeamento (ex.: só filiais de venda) antes de importar.`,
      );
    }
    const plano = planejarEstoque(
      lido.linhas,
      await deps.destino.produtosVinculados(),
    );
    const { produtosAtualizados } = await deps.destino.substituirEstoque(
      plano.registros,
    );
    return {
      tipo,
      lidas: lido.lidas,
      comErro: lido.comErro,
      gravados: plano.registros.length,
      falhas: [],
      proximo: null,
      estoque: {
        registros: plano.registros.length,
        semProdutoNoNerp: plano.semProduto,
        produtosAtualizados,
      },
    };
  }

  const tamanho = Math.min(Math.max(opcoes.tamanho, 1), LOTE_MAXIMO);
  const pagina = await lerPagina(
    deps,
    tipo,
    resolucao,
    opcoes.depoisDe,
    tamanho,
  );
  if (tipo === "produto") {
    const acoes = planejarProdutos(
      pagina.linhas,
      await deps.destino.produtosLocais(),
      opcoes,
    );
    const gravacao = await deps.destino.aplicarProdutos(acoes);
    return {
      tipo,
      lidas: pagina.lidas,
      comErro: pagina.comErro,
      resumo: resumirAcoes(acoes, descreverProduto),
      gravados: gravacao.gravados,
      falhas: gravacao.falhas.slice(0, 20),
      proximo: pagina.proximo,
    };
  }
  const acoes = planejarClientes(
    pagina.linhas,
    await deps.destino.clientesLocais(),
    opcoes,
  );
  const gravacao = await deps.destino.aplicarClientes(acoes);
  return {
    tipo,
    lidas: pagina.lidas,
    comErro: pagina.comErro,
    resumo: resumirAcoes(acoes, descreverCliente),
    gravados: gravacao.gravados,
    falhas: gravacao.falhas.slice(0, 20),
    proximo: pagina.proximo,
  };
}
