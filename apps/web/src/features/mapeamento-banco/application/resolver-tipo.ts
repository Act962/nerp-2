import { ALVOS, type TipoDoNerp } from "../domain/alvos";
import type { ResumoDaTabela } from "../domain/estrutura";
import {
  type ConfigDoTipo,
  type Diagnostico,
  type Estruturas,
  type Modo,
  type Origem,
  validarOrigem,
} from "../domain/mapeamento";
import { origemDoPerfil } from "../domain/perfis";
import type { Dependencias } from "./dependencias";

// De onde um tipo vai ler, de fato, neste banco: a origem manual conferida
// contra a estrutura real, ou o primeiro perfil automático que funciona aqui.

export type StatusDoTipo =
  | "pronto"
  | "incompleto"
  | "indisponivel"
  | "desligado";

export interface PerfilRecusado {
  perfil: string;
  motivo: string;
}

/** O que a tela recebe — sem a estrutura completa das tabelas. */
export interface ResumoDoTipo {
  tipo: TipoDoNerp;
  modo: Modo;
  status: StatusDoTipo;
  origem: Origem | null;
  perfil: { chave: string; rotulo: string } | null;
  diagnostico: Diagnostico;
  recusados: PerfilRecusado[];
}

export interface ResolucaoDoTipo extends ResumoDoTipo {
  estruturas: Estruturas | null;
}

type Carregadas =
  | { ok: true; estruturas: Estruturas }
  | { ok: false; motivo: string };

async function carregarEstruturas(
  deps: Dependencias,
  origem: Origem,
): Promise<Carregadas> {
  const base = await deps.banco.descreverTabela(origem.tabela);
  if (!base) {
    return {
      ok: false,
      motivo: `${origem.tabela.nome}: a tabela não existe ou não está acessível.`,
    };
  }
  let juncao = null;
  if (origem.juncao) {
    juncao = await deps.banco.descreverTabela(origem.juncao.tabela);
    if (!juncao) {
      return {
        ok: false,
        motivo: `${origem.juncao.tabela.nome}: a tabela da junção não existe ou não está acessível.`,
      };
    }
  }
  return { ok: true, estruturas: { base, juncao } };
}

function semDiagnostico(): Diagnostico {
  return { erros: [], avisos: [] };
}

export function resumir(resolucao: ResolucaoDoTipo): ResumoDoTipo {
  const { estruturas: _estruturas, ...resumo } = resolucao;
  return resumo;
}

async function resolverManual(
  deps: Dependencias,
  tipo: TipoDoNerp,
  origem: Origem,
): Promise<ResolucaoDoTipo> {
  const carregadas = await carregarEstruturas(deps, origem);
  if (!carregadas.ok) {
    return {
      tipo,
      modo: "manual",
      status: "incompleto",
      origem,
      perfil: null,
      diagnostico: { erros: [carregadas.motivo], avisos: [] },
      recusados: [],
      estruturas: null,
    };
  }
  const diagnostico = validarOrigem(ALVOS[tipo], origem, carregadas.estruturas);
  return {
    tipo,
    modo: "manual",
    status: diagnostico.erros.length === 0 ? "pronto" : "incompleto",
    origem,
    perfil: null,
    diagnostico,
    recusados: [],
    estruturas: carregadas.estruturas,
  };
}

/**
 * Tenta os perfis na ordem e fica com o primeiro que passa na validação.
 * Os recusados voltam com o motivo — é o que explica, por exemplo, por que o
 * preço sai do histórico de vendas e não da tabela de preço.
 */
export async function resolverAutomatico(
  deps: Dependencias,
  tipo: TipoDoNerp,
  tabelas: ResumoDaTabela[],
): Promise<ResolucaoDoTipo> {
  const recusados: PerfilRecusado[] = [];
  const { schemaPrincipal } = deps.banco.descricao;

  for (const perfil of deps.vocabulario.perfis(tipo)) {
    const montada = origemDoPerfil(perfil, tabelas, schemaPrincipal);
    if (!montada.ok) {
      recusados.push({ perfil: perfil.rotulo, motivo: montada.motivo });
      continue;
    }
    const carregadas = await carregarEstruturas(deps, montada.origem);
    if (!carregadas.ok) {
      recusados.push({ perfil: perfil.rotulo, motivo: carregadas.motivo });
      continue;
    }
    const diagnostico = validarOrigem(
      ALVOS[tipo],
      montada.origem,
      carregadas.estruturas,
    );
    if (diagnostico.erros.length > 0) {
      recusados.push({ perfil: perfil.rotulo, motivo: diagnostico.erros[0] });
      continue;
    }
    return {
      tipo,
      modo: "auto",
      status: "pronto",
      origem: montada.origem,
      perfil: { chave: perfil.chave, rotulo: perfil.rotulo },
      diagnostico,
      recusados,
      estruturas: carregadas.estruturas,
    };
  }

  return {
    tipo,
    modo: "auto",
    status: "indisponivel",
    origem: null,
    perfil: null,
    diagnostico: {
      erros: [
        recusados.length > 0
          ? "Nenhum perfil automático funciona neste banco. Mapeie manualmente."
          : `Não há perfil automático de ${ALVOS[tipo].rotulo} para ${deps.vocabulario.nome}. Mapeie manualmente.`,
      ],
      avisos: [],
    },
    recusados,
    estruturas: null,
  };
}

export async function resolverTipo(
  deps: Dependencias,
  tipo: TipoDoNerp,
  config: ConfigDoTipo,
  tabelas?: ResumoDaTabela[],
): Promise<ResolucaoDoTipo> {
  if (config.modo === "desligado") {
    return {
      tipo,
      modo: "desligado",
      status: "desligado",
      origem: null,
      perfil: null,
      diagnostico: semDiagnostico(),
      recusados: [],
      estruturas: null,
    };
  }
  if (config.modo === "manual" && config.origem) {
    return resolverManual(deps, tipo, config.origem);
  }
  return resolverAutomatico(
    deps,
    tipo,
    tabelas ?? (await deps.banco.listarTabelas()),
  );
}
