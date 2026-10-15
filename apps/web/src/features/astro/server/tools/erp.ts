import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import {
  loadSchemaDictionary,
  resolveColumn,
  resolveTable,
} from "@/features/erp-sync/server/oracle-explorer/dictionary";
import {
  OracleQueryRefusedError,
  runOracleQuery,
} from "@/features/erp-sync/server/oracle-explorer/run-query";
import { withOracleReadOnly } from "@/features/erp-sync/server/oracle-client";
import type { WidgetValue } from "@/app/router/dashboard-widgets/_types";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import type { ContextoToolsApp } from "./_contexto";
import {
  DEFINICOES,
  descreverRecorte,
  escolhasPara,
  type Filial,
  gruposDeFilial,
  INDICADORES,
  type Indicador,
  montarConfig,
  oQueFalta,
  periodoSchema,
  periodosAceitos,
  resolverPeriodo,
  rotuloDaFilial,
  SEM_FILIAL,
  TODAS_AS_FILIAIS,
} from "../erp-consulta/indicadores";

/**
 * Números do Winthor, direto do Oracle do cliente.
 *
 * Passa pelo MESMO caminho do construtor de consultas do dashboard — dicionário,
 * pré-voo, sessão só leitura, timeout curto — via `runOracleQuery`. A tool não
 * escreve SQL: ela monta a `OracleQueryConfig` a partir de um indicador curado.
 *
 * Filtro que falta é decidido AQUI, não no prompt: sem filial ou sem período a
 * tool não consulta, e devolve as perguntas com as opções reais. É o que
 * impede o "312 inadimplentes" de sair da empresa inteira quando a pessoa
 * pensava na matriz.
 */

const LIMITE_DA_LISTA = 20;
const CACHE_DAS_FILIAIS_MS = 60 * 60 * 1000;

const cacheDasFiliais = new Map<
  string,
  { expiraEm: number; filiais: Filial[] }
>();

/**
 * As filiais do cliente, com o nome que ele reconhece.
 *
 * O nome vem primeiro do espelho de estoque — o mesmo que a tela de
 * Integrações mostra — e só depois de `PCFILIAL.FANTASIA`, que neste cliente se
 * repete entre filiais. Filial sem nome nenhum fica de fora das opções: é
 * código técnico (99, depósito virtual), não loja.
 */
async function carregarFiliais(organizationId: string): Promise<Filial[]> {
  const guardado = cacheDasFiliais.get(organizationId);
  if (guardado && guardado.expiraEm > Date.now()) return guardado.filiais;

  const dicionario = await loadSchemaDictionary(organizationId);
  const tabela = resolveTable(dicionario, "PCFILIAL");
  const codigo = resolveColumn(tabela, "CODIGO");
  const fantasia = resolveColumn(tabela, "FANTASIA");
  const config = await loadOracleConfig(organizationId);

  const [linhas, espelho] = await Promise.all([
    withOracleReadOnly(
      config,
      (query) =>
        query<{ CODIGO: string | number; FANTASIA: string | null }>(
          `SELECT ${codigo.name} AS "CODIGO", ${fantasia.name} AS "FANTASIA"
             FROM ${dicionario.schema}.${tabela.name}
            ORDER BY ${codigo.name}
            FETCH FIRST 50 ROWS ONLY`,
        ),
      { callTimeoutMs: 15_000 },
    ),
    prisma.productBranchStock.groupBy({
      by: ["branchCode", "branchName"],
      where: { organizationId },
    }),
  ]);

  const nomeNoEspelho = new Map(
    espelho
      .filter((linha) => linha.branchName?.trim())
      .map((linha) => [
        linha.branchCode.trim(),
        linha.branchName?.trim() ?? "",
      ]),
  );

  const filiais = linhas
    .map((linha) => {
      const codigoTexto = String(linha.CODIGO).trim();
      const nome =
        nomeNoEspelho.get(codigoTexto) || linha.FANTASIA?.trim() || "";
      return { codigo: codigoTexto, nome };
    })
    .filter((filial) => filial.nome !== "");

  cacheDasFiliais.set(organizationId, {
    expiraEm: Date.now() + CACHE_DAS_FILIAIS_MS,
    filiais,
  });
  return filiais;
}

/** O valor de um STAT, ou 0 quando a consulta não devolveu linha. */
function valorDoStat(valor: WidgetValue): number {
  return valor.kind === "STAT" ? valor.value : 0;
}

/**
 * Falha do Oracle em português. O texto cru do driver (ORA-xxxxx, NJS-xxx) não
 * diz nada a quem pergunta e expõe detalhe do banco do cliente.
 */
function explicarFalha(erro: unknown): string {
  if (erro instanceof OracleQueryRefusedError) {
    return `Essa consulta foi barrada pela checagem de segurança do ERP: ${erro.message}`;
  }
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  if (/NJS-040|NJS-123|DPI-1067|timeout|ORA-01013/i.test(mensagem)) {
    return "O ERP demorou demais para responder e a consulta foi cancelada. Tente um período menor.";
  }
  if (/ORA-00942|ORA-01031/.test(mensagem)) {
    return "O usuário de leitura do ERP não tem acesso a essa tabela. Peça à equipe do Winthor para liberar.";
  }
  if (/ORA-12541|ORA-12170|ORA-12514|ECONNREFUSED|ETIMEDOUT/i.test(mensagem)) {
    return "Não consegui me conectar ao ERP agora. Confira a conexão em Integrações.";
  }
  return "O ERP recusou a consulta. Tente de novo em instantes.";
}

export function construirToolsDeErp(ctx: ContextoToolsApp): ToolSet {
  // Sem Oracle ou sem permissão, a tool nem existe: schema que só serve para
  // responder "você não pode" é custo em toda mensagem.
  if (!ctx.podeConsultarErp) return {};
  const { organizationId, userId } = ctx;

  return {
    consultarErp: tool({
      description: [
        "Números do ERP Winthor (Oracle) da empresa: inadimplência, clientes sem compra e vendas, por filial e período.",
        "Use SEMPRE que a pergunta for de relatório sobre esses assuntos — o ERP é a fonte, não o cadastro do NERP.",
        "Só mande `filiais` e `periodo` se a pessoa disse. Se ela não disse, chame SEM eles: a tool devolve `escolhas`, e aí você faz as perguntas e espera a resposta, sem dar número nenhum.",
        `filiais: códigos ("1", "2"), "${SEM_FILIAL}" para cliente sem filial no cadastro, "${TODAS_AS_FILIAIS}" para a empresa inteira. Use o código que aparece no rótulo "Filial N · NOME".`,
        `periodo: {tipo:"haMaisDe", dias, desde?} = aconteceu há mais de N dias (clientes sem compra, parcelas vencidas; "todas as vencidas" é dias 0; "com compra em 2026" é desde "2026-01-01"); {tipo:"ultimos", dias} = nos últimos N dias; {tipo:"intervalo", de, ate} em AAAA-MM-DD ("este ano", "este mês").`,
        "Na resposta, cite o campo `recorte` exatamente como veio.",
      ].join(" "),
      inputSchema: z.object({
        indicador: z.enum(INDICADORES),
        filiais: z.array(z.string().max(10)).max(8).optional(),
        periodo: periodoSchema.optional(),
        formato: z
          .enum(["numero", "lista"])
          .default("numero")
          .describe("lista = os clientes, um por linha (até 20)."),
      }),
      execute: async ({ indicador, filiais, periodo, formato }) => {
        // A rota já só monta a tool para admin; a checagem de novo aqui é a
        // mesma do construtor de consultas — o Oracle é produção do cliente.
        if (!(await isOrgAdmin(organizationId, userId))) {
          return {
            erro: "Só administradores da empresa podem consultar o ERP.",
          };
        }

        let todasAsFiliais: Filial[];
        try {
          todasAsFiliais = await carregarFiliais(organizationId);
        } catch (erro) {
          console.error("[astro] consultarErp: filiais", erro);
          return { erro: explicarFalha(erro) };
        }

        const falta = oQueFalta(indicador, { filiais, periodo });
        if (falta.length > 0) {
          return {
            faltaFiltro: falta,
            escolhas: escolhasPara(indicador, falta, todasAsFiliais),
            periodosAceitos: periodosAceitos(indicador),
            instrucao:
              "Não dê número nenhum ainda. Pergunte, numa frase curta, só o que falta — os botões já aparecem para a pessoa — e espere a resposta.",
          };
        }

        // `oQueFalta` vazio garante os dois; o narrowing do TS não vê isso.
        if (!filiais || !periodo) return { erro: "Filtro incompleto." };

        const definicao = DEFINICOES[indicador];
        const conhecidas = new Set(todasAsFiliais.map((f) => f.codigo));
        const validos = new Set([
          ...conhecidas,
          TODAS_AS_FILIAIS,
          ...(definicao.aceitaSemFilial ? [SEM_FILIAL] : []),
        ]);
        const desconhecidas = filiais.filter((codigo) => !validos.has(codigo));
        if (desconhecidas.length > 0) {
          return {
            erro: `Não conheço a filial ${desconhecidas.join(", ")}.`,
            escolhas: escolhasPara(indicador, ["filial"], todasAsFiliais),
          };
        }

        const intervalo = resolverPeriodo(indicador, periodo);
        if ("erro" in intervalo) return { erro: intervalo.erro };

        const recorte = descreverRecorte({
          indicador,
          filiais,
          periodo,
          intervalo,
          todasAsFiliais,
        });
        const grupos = gruposDeFilial(filiais);

        try {
          if (formato === "lista") {
            return await listar({
              organizationId,
              indicador,
              grupos,
              intervalo,
              recorte,
            });
          }

          // Por medida, um total: o `in` dos códigos vai junto numa consulta
          // só, e é isso que faz cliente que deve em duas filiais contar uma
          // vez. O grupo "sem filial" não se sobrepõe a nenhum código, então
          // somar os dois não conta ninguém duas vezes.
          const totais = await Promise.all(
            definicao.medidas.map(async (medida) => {
              const valores = await Promise.all(
                grupos.map((grupo) =>
                  runOracleQuery(
                    organizationId,
                    montarConfig({
                      indicador,
                      filiais: grupo,
                      intervalo,
                      medida,
                    }),
                    "STAT",
                  ),
                ),
              );
              return {
                medida: medida.label,
                unidade: medida.unit,
                valor: valores.reduce(
                  (soma, resultado) => soma + valorDoStat(resultado.value),
                  0,
                ),
              };
            }),
          );

          // Mais de um recorte: o detalhe por filial vem de graça e é o que a
          // pessoa pergunta em seguida.
          const individuais = filiais.filter(
            (codigo) => codigo !== TODAS_AS_FILIAIS,
          );
          const porFilial =
            individuais.length > 1
              ? await Promise.all(
                  individuais.map(async (codigo) => ({
                    filial: rotuloDaFilial(codigo, todasAsFiliais),
                    valores: await Promise.all(
                      definicao.medidas.map(async (medida) => ({
                        medida: medida.label,
                        valor: valorDoStat(
                          (
                            await runOracleQuery(
                              organizationId,
                              montarConfig({
                                indicador,
                                filiais: [codigo],
                                intervalo,
                                medida,
                              }),
                              "STAT",
                            )
                          ).value,
                        ),
                      })),
                    ),
                  })),
                )
              : undefined;

          return { recorte, totais, porFilial, fonte: "ERP Winthor (Oracle)" };
        } catch (erro) {
          console.error("[astro] consultarErp", {
            organizationId,
            indicador,
            erro,
          });
          return { erro: explicarFalha(erro), recorte };
        }
      },
    }),
  };
}

/** Os clientes do recorte, um por linha, juntando os grupos de filial. */
async function listar(entrada: {
  organizationId: string;
  indicador: Indicador;
  grupos: (string[] | null)[];
  intervalo: { de: string; ate: string };
  recorte: string;
}) {
  const definicao = DEFINICOES[entrada.indicador];
  const resultados = await Promise.all(
    entrada.grupos.map((grupo) =>
      runOracleQuery(
        entrada.organizationId,
        montarConfig({
          indicador: entrada.indicador,
          filiais: grupo,
          intervalo: entrada.intervalo,
          medida: definicao.lista,
          agruparPorCliente: true,
          limite: LIMITE_DA_LISTA,
        }),
        "TABLE",
      ),
    ),
  );

  const linhas = resultados.flatMap((resultado) =>
    resultado.value.kind === "TABLE"
      ? resultado.value.rows.map((linha) => ({
          cliente: String(linha.cells[0] ?? "—"),
          [definicao.lista.label]: linha.cells[1] ?? null,
        }))
      : [],
  );

  return {
    recorte: entrada.recorte,
    coluna: definicao.lista.label,
    clientes: linhas.slice(0, LIMITE_DA_LISTA),
    mostrando: Math.min(linhas.length, LIMITE_DA_LISTA),
    observacao:
      linhas.length >= LIMITE_DA_LISTA
        ? `Mostrando os ${LIMITE_DA_LISTA} primeiros. Para o total, pergunte o número.`
        : undefined,
    fonte: "ERP Winthor (Oracle)",
  };
}
