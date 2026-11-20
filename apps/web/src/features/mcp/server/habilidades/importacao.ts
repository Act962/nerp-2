import "server-only";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  LOTE_MAXIMO,
  LOTE_PADRAO,
  importarLote,
  simularImportacao,
} from "@/features/mapeamento-banco/application/importar";
import {
  TIPOS_IMPORTAVEIS,
  type TipoImportavel,
} from "@/features/mapeamento-banco/domain/importacao";
import type { AgenteAutenticado } from "../autenticar";
import { executar } from "../executar";

// Habilidade "importar dados": lê o banco do ERP pelo mapeamento SALVO e grava
// no cadastro do NERP. Escopo próprio (`mcp:importacao`) porque, ao contrário
// do mapeamento, escreve. As regras — o que casa com o quê, o que o ERP pode
// sobrescrever — estão em `domain/importacao.ts`; aqui é só a porta.

const tipoImportavel = z
  .enum(TIPOS_IMPORTAVEIS)
  .describe(
    "produto (cadastro), cliente (cadastro) ou estoque (disponível por filial). Importe produto antes de estoque.",
  );

const criarFaltantes = z
  .boolean()
  .optional()
  .describe(
    "Criar no NERP o que não existe lá. Padrão: produto = não (só vincula e preenche os que já existem); cliente = sim. Não se aplica a estoque.",
  );

const PADRAO_DE_CRIAR: Record<TipoImportavel, boolean> = {
  produto: false,
  cliente: true,
  estoque: false,
};

const cursor = z
  .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .max(2)
  .nullable()
  .optional()
  .describe(
    "O 'proximo' devolvido pela chamada anterior, tal como veio. Omita na primeira.",
  );

export function registrarImportacao(
  servidor: McpServer,
  agente: AgenteAutenticado,
): void {
  servidor.registerTool(
    "simular_importacao",
    {
      title: "Simular a importação (não grava)",
      description:
        "Lê TODO o tipo no banco do ERP pelo mapeamento salvo e diz o que a importação faria, sem gravar nada: quantos seriam criados, vinculados (casados por código de barras ou CPF/CNPJ), preenchidos (campo vazio no NERP), ignorados e por quê, com exemplos. No estoque: quantos registros com saldo disponível, quantos sem produto no NERP e a filial que vira o estoque do produto. Pode levar até um minuto. Sempre rode antes de importar e mostre o resultado ao usuário.",
      inputSchema: { tipo: tipoImportavel, criar_faltantes: criarFaltantes },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      executar(agente, (deps) =>
        simularImportacao(deps, args.tipo, {
          criarFaltantes: args.criar_faltantes ?? PADRAO_DE_CRIAR[args.tipo],
        }),
      ),
  );

  servidor.registerTool(
    "importar",
    {
      title: "Importar do ERP para o NERP",
      description: [
        "GRAVA no cadastro do NERP o que simular_importacao mostrou. Só chame depois de mostrar a simulação e de o usuário confirmar, com confirmado = true.",
        `Produto e cliente vão em lotes: cada chamada grava até 'tamanho' linhas (padrão ${LOTE_PADRAO}, máximo ${LOTE_MAXIMO}) e devolve 'proximo'; chame de novo com depois_de = proximo até vir null. Repetir um lote é seguro: o que já foi gravado volta como 'sem mudança'.`,
        "Produto: casa pelo código do ERP e depois pelo código de barras; o ERP só PREENCHE campo vazio (código de barras, unidades por caixa) e sempre atualiza 'ativo no ERP'; nome, preço e categoria do NERP não mudam.",
        "Cliente: casa pelo código do ERP e depois pelo CPF/CNPJ; preenche só documento, e-mail, telefone, cidade e UF vazios e sempre atualiza 'bloqueado no ERP'.",
        "Estoque: uma chamada só; troca o retrato do estoque por filial e põe o disponível da filial configurada como estoque dos produtos vinculados.",
      ].join(" "),
      inputSchema: {
        tipo: tipoImportavel,
        confirmado: z
          .literal(true)
          .describe("true: o usuário viu a simulação e confirmou."),
        depois_de: cursor,
        tamanho: z
          .number()
          .int()
          .min(1)
          .max(LOTE_MAXIMO)
          .optional()
          .describe(`Linhas por lote (padrão ${LOTE_PADRAO}).`),
        criar_faltantes: criarFaltantes,
      },
      annotations: {
        readOnlyHint: false,
        // Estoque substitui o retrato inteiro.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args) =>
      executar(agente, async (deps) => {
        const resultado = await importarLote(deps, args.tipo, {
          criarFaltantes: args.criar_faltantes ?? PADRAO_DE_CRIAR[args.tipo],
          depoisDe: args.depois_de ?? null,
          tamanho: args.tamanho ?? LOTE_PADRAO,
        });
        return {
          ...resultado,
          continuar: resultado.proximo
            ? "Chame importar de novo com depois_de = proximo."
            : "Acabou: não há mais linhas deste tipo.",
        };
      }),
  );

  servidor.registerPrompt(
    "importar_dados",
    {
      title: "Importar dados do ERP para o NERP",
      description:
        "Roteiro para subir produtos, estoque e clientes do ERP para o NERP, simulando antes de gravar.",
      argsSchema: {
        tipo: z
          .string()
          .optional()
          .describe("Opcional: só um tipo (produto, estoque ou cliente)"),
      },
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: roteiroDeImportacao(args.tipo) },
        },
      ],
    }),
  );
}

function roteiroDeImportacao(tipo: string | undefined): string {
  const ordem = tipo
    ? `Importe só o tipo "${tipo}".`
    : "Siga a ordem produto → estoque → cliente (o estoque precisa dos produtos já vinculados).";
  return [
    "Quero subir os dados do ERP deste cliente para o NERP. Conduza comigo, em português:",
    "1. Chame estado_do_mapeamento: cada tipo a importar precisa estar 'pronto'. Se não estiver, pare e me diga o que falta (o mapeamento vem antes).",
    `2. ${ordem}`,
    "3. Para cada tipo: chame simular_importacao e me mostre, numa tabela curta, quantos seriam criados, vinculados, preenchidos, sem mudança e ignorados (com os motivos). Destaque o que parecer errado — muitos ignorados, códigos de barras em conflito, estoque quase todo 'sem produto'.",
    "4. Pergunte se pode gravar. No produto, pergunte também se devo criar os que não existem no NERP (o padrão é só vincular os existentes).",
    "5. Com o meu sim, chame importar com confirmado = true e repita com depois_de = proximo até acabar, me dando o total gravado e as falhas ao fim (não a cada lote).",
    "Regras: nunca chame importar sem a minha confirmação daquele tipo; o banco do ERP é só leitura; se um lote falhar, pare e me mostre o motivo.",
  ].join("\n");
}
