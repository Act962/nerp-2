import { ALVOS, TIPOS_DO_NERP, type TipoDoNerp } from "../domain/alvos";
import { type LinhaConvertida, converterLinha } from "../domain/converter";
import type { ConfigDoTipo, Mapeamento, Origem } from "../domain/mapeamento";
import { type Dependencias, MapeamentoInvalido } from "./dependencias";
import {
  type PerfilRecusado,
  type ResumoDoTipo,
  resolverAutomatico,
  resolverTipo,
  resumir,
} from "./resolver-tipo";

// Casos de uso do modo Mapear: ver como cada tipo está, sugerir pelo perfil,
// testar com dado real e salvar.

export interface EstadoDoMapeamento {
  mapeamento: Mapeamento;
  tipos: ResumoDoTipo[];
}

/** Uma resolução por tipo, em sequência: são leituras no ERP do cliente, e
 * cinco ao mesmo tempo disputariam a mesma credencial. */
export async function estadoDoMapeamento(
  deps: Dependencias,
): Promise<EstadoDoMapeamento> {
  const [mapeamento, tabelas] = await Promise.all([
    deps.repositorio.carregar(),
    deps.banco.listarTabelas(),
  ]);
  const tipos: ResumoDoTipo[] = [];
  for (const tipo of TIPOS_DO_NERP) {
    tipos.push(
      resumir(await resolverTipo(deps, tipo, mapeamento.tipos[tipo], tabelas)),
    );
  }
  return { mapeamento, tipos };
}

export interface Sugestao {
  tipo: TipoDoNerp;
  origem: Origem | null;
  perfil: { chave: string; rotulo: string } | null;
  recusados: PerfilRecusado[];
  avisos: string[];
}

/** O que o automático usaria — para o editor partir dele e ajustar. */
export async function sugerirMapeamento(
  deps: Dependencias,
  tipo: TipoDoNerp,
): Promise<Sugestao> {
  const resolucao = await resolverAutomatico(
    deps,
    tipo,
    await deps.banco.listarTabelas(),
  );
  return {
    tipo,
    origem: resolucao.origem,
    perfil: resolucao.perfil,
    recusados: resolucao.recusados,
    avisos: resolucao.diagnostico.avisos,
  };
}

export const LINHAS_DO_TESTE = 10;
/** O teste não precisa de 90 dias de histórico — só de dado recente. */
export const DIAS_DO_TESTE = 3;

export interface LinhaDoTeste extends LinhaConvertida {
  /** O código bate com um item já cadastrado no NERP? null = não se aplica. */
  existeNoNerp: boolean | null;
}

export interface ResultadoDoTeste {
  tipo: ResumoDoTipo;
  linhas: LinhaDoTeste[];
  tempoMs: number;
}

/**
 * Lê poucas linhas pelo mapeamento (salvo ou o rascunho do editor) e mostra o
 * que o NERP receberia. Com `codigo`, procura só aquele item — é o jeito de
 * conferir um produto conhecido ("o Purelac está a 21,45?").
 */
export async function testarMapeamento(
  deps: Dependencias,
  tipo: TipoDoNerp,
  rascunho: ConfigDoTipo | null,
  codigo: string | null,
): Promise<ResultadoDoTeste> {
  const config = rascunho ?? (await deps.repositorio.carregar()).tipos[tipo];
  const resolucao = await resolverTipo(deps, tipo, config);
  if (
    resolucao.status !== "pronto" ||
    !resolucao.origem ||
    !resolucao.estruturas
  ) {
    return { tipo: resumir(resolucao), linhas: [], tempoMs: 0 };
  }

  const alvo = ALVOS[tipo];
  const inicio = Date.now();
  const cruas = await deps.banco.lerMapeado({
    alvo,
    origem: resolucao.origem,
    base: resolucao.estruturas.base,
    juncao: resolucao.estruturas.juncao,
    limite: LINHAS_DO_TESTE,
    codigo: codigo?.trim() || null,
    diasNoMaximo: codigo?.trim() ? null : DIAS_DO_TESTE,
  });
  const tempoMs = Date.now() - inicio;

  const convertidas = cruas.map((linha) =>
    converterLinha(alvo, linha, resolucao.origem?.conversoes ?? {}),
  );
  const campoChave = alvo.campos[0].chave;
  const codigos = convertidas
    .map((linha) => linha.valores[campoChave])
    .filter((valor): valor is string => typeof valor === "string");
  const existentes = await deps.nerp.codigosExistentes(tipo, codigos);

  return {
    tipo: resumir(resolucao),
    tempoMs,
    linhas: convertidas.map((linha) => {
      const valor = linha.valores[campoChave];
      return {
        ...linha,
        existeNoNerp:
          existentes === null
            ? null
            : typeof valor === "string" && existentes.has(valor),
      };
    }),
  };
}

/**
 * Grava a configuração de UM tipo. Manual só entra se passar na validação
 * contra a estrutura real — salvar algo que o sync não consegue ler seria
 * adiar o erro para a madrugada.
 */
export async function salvarMapeamento(
  deps: Dependencias,
  tipo: TipoDoNerp,
  config: ConfigDoTipo,
): Promise<ResumoDoTipo> {
  const resolucao = await resolverTipo(deps, tipo, config);
  if (config.modo === "manual" && resolucao.diagnostico.erros.length > 0) {
    throw new MapeamentoInvalido(resolucao.diagnostico.erros);
  }
  const mapeamento = await deps.repositorio.carregar();
  await deps.repositorio.salvar({
    ...mapeamento,
    tipos: { ...mapeamento.tipos, [tipo]: config },
  });
  return resumir(resolucao);
}
