import "server-only";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { amostrarTabela } from "@/features/mapeamento-banco/application/amostrar-tabela";
import { descreverTabela } from "@/features/mapeamento-banco/application/descrever-tabela";
import { diagramaDoSchema } from "@/features/mapeamento-banco/application/diagrama";
import { explorarBanco } from "@/features/mapeamento-banco/application/explorar-banco";
import {
  buscarColunas,
  perfilarColuna,
} from "@/features/mapeamento-banco/application/perfilar-coluna";
import {
  estadoDoMapeamento,
  salvarMapeamento,
  sugerirMapeamento,
  testarMapeamento,
} from "@/features/mapeamento-banco/application/mapear";
import {
  resolverTipo,
  resumir,
} from "@/features/mapeamento-banco/application/resolver-tipo";
import {
  ALVOS,
  CONVERSOES,
  CONVERSOES_POR_TIPO,
  ROTULO_DA_CONVERSAO,
  TIPOS_DO_NERP,
} from "@/features/mapeamento-banco/domain/alvos";
import {
  OPERADORES,
  ROTULO_DO_OPERADOR,
  configDoTipoSchema,
} from "@/features/mapeamento-banco/domain/mapeamento";
import type { AgenteAutenticado } from "../autenticar";
import { executar, texto } from "../executar";

// Habilidade "mapear o banco do ERP": as mesmas operações da página
// /integracoes/banco-de-dados, chamando os MESMOS casos de uso. O MCP é só
// outra porta de entrada — a regra (o que é tabela grande, o que é mapeamento
// válido, o que pode ser salvo) continua num lugar só.

const tipoDoNerp = z
  .enum(TIPOS_DO_NERP)
  .describe(`Tipo de dado do NERP: ${TIPOS_DO_NERP.join(", ")}`);
const nomeNoBanco = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .describe("Nome exato como aparece no banco (ex.: PCPRODUT)");

const SO_LEITURA = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export function registrarMapeamento(
  servidor: McpServer,
  agente: AgenteAutenticado,
): void {
  servidor.registerTool(
    "conexao_do_banco",
    {
      title: "Conexão com o banco do ERP",
      description:
        "Qual banco está conectado (motor, ERP, schema principal, servidor) e se a credencial responde. Comece por aqui.",
      inputSchema: {},
      annotations: SO_LEITURA,
    },
    () =>
      executar(agente, async (deps) => {
        let conectado = true;
        let mensagem: string | null = null;
        try {
          await deps.banco.testarConexao();
        } catch (erro) {
          conectado = false;
          mensagem = deps.banco.explicarFalha(erro);
        }
        return {
          ...deps.banco.descricao,
          erp: deps.vocabulario.nome,
          conectado,
          mensagem,
        };
      }),
  );

  servidor.registerTool(
    "tipos_do_nerp",
    {
      title: "O que o NERP precisa de cada tipo",
      description:
        "Contrato do lado do NERP: para cada tipo (produto, estoque, categoria, cliente, preço, promoção), os campos, quais são obrigatórios e o tipo esperado; as conversões permitidas, os operadores de filtro e o formato do JSON de configuração usado em validar/testar/salvar.",
      inputSchema: {},
      annotations: SO_LEITURA,
    },
    () =>
      texto({
        tipos: Object.values(ALVOS),
        conversoes: CONVERSOES.map((chave) => ({
          chave,
          rotulo: ROTULO_DA_CONVERSAO[chave],
        })),
        conversoesPorTipoDeCampo: CONVERSOES_POR_TIPO,
        operadores: OPERADORES.map((chave) => ({
          chave,
          rotulo: ROTULO_DO_OPERADOR[chave],
        })),
        formatoDaConfig: {
          explicacao:
            "modo 'auto' usa o perfil automático do ERP; 'manual' exige 'origem'; 'desligado' não lê o tipo. Colunas são referenciadas por { de: 'base' | 'juncao', nome }. Tabela acima de 1 milhão de linhas exige 'janela' numa coluna de data da própria tabela que seja a primeira coluna de um índice.",
          exemplo: {
            modo: "manual",
            origem: {
              tabela: { schema: "LGCARVALHO", nome: "PCPEDI" },
              juncao: {
                tabela: { schema: "LGCARVALHO", nome: "PCPEDC" },
                de: "NUMPED",
                para: "NUMPED",
              },
              colunas: {
                codigoProduto: { de: "base", nome: "CODPROD" },
                preco: { de: "base", nome: "PTABELA" },
                regiao: { de: "juncao", nome: "NUMREGIAO" },
                data: { de: "base", nome: "DATA" },
              },
              conversoes: {},
              filtros: [
                {
                  coluna: { de: "base", nome: "POSICAO" },
                  operador: "diferente",
                  valores: ["C"],
                },
              ],
              janela: { coluna: { de: "base", nome: "DATA" }, dias: 90 },
            },
          },
        },
      }),
  );

  servidor.registerTool(
    "listar_tabelas",
    {
      title: "Listar tabelas do banco",
      description:
        "Tabelas e views que a credencial enxerga, com nome de negócio (quando o ERP é conhecido), número de linhas (estatística) e os tipos do NERP que já leem de cada uma. Use 'busca' para filtrar por nome técnico ou de negócio.",
      inputSchema: {
        busca: z.string().max(80).optional(),
        schema: z.string().max(128).optional(),
        somente_com_dados: z.boolean().optional(),
        somente_mapeadas: z.boolean().optional(),
        limite: z.number().int().min(1).max(1000).optional(),
      },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, async (deps) => {
        const exploracao = await explorarBanco(deps);
        const termo = args.busca?.trim().toLowerCase() ?? "";
        const filtradas = exploracao.tabelas.filter(
          (tabela) =>
            (!args.schema || tabela.schema === args.schema) &&
            (!args.somente_com_dados || (tabela.linhas ?? 0) > 0) &&
            (!args.somente_mapeadas || tabela.mapeadaComo.length > 0) &&
            (!termo ||
              `${tabela.nome} ${tabela.rotulo ?? ""}`
                .toLowerCase()
                .includes(termo)),
        );
        const limite = args.limite ?? 200;
        return {
          erp: exploracao.erp,
          schemaPrincipal: exploracao.conexao.schemaPrincipal,
          total: filtradas.length,
          mostrando: Math.min(limite, filtradas.length),
          tabelas: filtradas.slice(0, limite).map((tabela) => ({
            schema: tabela.schema,
            nome: tabela.nome,
            rotulo: tabela.rotulo,
            tipo: tabela.tipo,
            linhas: tabela.linhas,
            mapeadaComo: tabela.mapeadaComo,
          })),
        };
      }),
  );

  servidor.registerTool(
    "descrever_tabela",
    {
      title: "Descrever uma tabela",
      description:
        "Colunas (tipo, aceita nulo, chave primária, se é a primeira coluna de um índice), índices e chaves estrangeiras de uma tabela. Tabelas de ERP podem ter centenas de colunas: use 'busca_coluna' para filtrar.",
      inputSchema: {
        schema: nomeNoBanco,
        tabela: nomeNoBanco,
        busca_coluna: z.string().max(80).optional(),
      },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, async (deps) => {
        const tabela = await descreverTabela(deps, {
          schema: args.schema,
          nome: args.tabela,
        });
        const termo = args.busca_coluna?.trim().toLowerCase() ?? "";
        const colunas = tabela.colunas.filter(
          (coluna) =>
            !termo ||
            `${coluna.nome} ${coluna.rotulo ?? ""} ${coluna.descricao ?? ""}`
              .toLowerCase()
              .includes(termo),
        );
        return {
          schema: tabela.schema,
          nome: tabela.nome,
          rotulo: tabela.rotulo,
          descricao: tabela.descricao,
          tipo: tabela.tipo,
          linhas: tabela.linhas,
          grande: (tabela.linhas ?? 0) >= 1_000_000,
          chavePrimaria: tabela.chavePrimaria,
          totalDeColunas: tabela.colunas.length,
          colunas: colunas.map((coluna) => ({
            nome: coluna.nome,
            tipo: coluna.tipoNativo,
            categoria: coluna.tipo,
            aceitaNulo: coluna.aceitaNulo,
            chavePrimaria: coluna.chavePrimaria,
            indiceLider: coluna.indiceLider,
            indexada: coluna.indexada,
            rotulo: coluna.rotulo,
            descricao: coluna.descricao,
          })),
          indices: tabela.indices,
          relacoes: tabela.relacoes,
          referenciadaPor: tabela.referenciadaPor,
        };
      }),
  );

  servidor.registerTool(
    "amostrar_tabela",
    {
      title: "Ver linhas de uma tabela",
      description:
        "Até 50 linhas reais da tabela, para entender o dado. Filtro por igualdade numa coluna (data no formato AAAA-MM-DD). Em tabela grande, filtro e ordem só pela primeira coluna de um índice — senão a leitura é recusada com o motivo.",
      inputSchema: {
        schema: nomeNoBanco,
        tabela: nomeNoBanco,
        colunas: z.array(nomeNoBanco).max(100).optional(),
        filtro_coluna: nomeNoBanco.optional(),
        filtro_valor: z.string().max(200).optional(),
        ordenar_por: nomeNoBanco.optional(),
        direcao: z.enum(["asc", "desc"]).optional(),
        pagina: z.number().int().min(0).max(19).optional(),
      },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, (deps) =>
        amostrarTabela(deps, {
          tabela: { schema: args.schema, nome: args.tabela },
          colunas: args.colunas,
          filtro:
            args.filtro_coluna && args.filtro_valor
              ? { coluna: args.filtro_coluna, valor: args.filtro_valor }
              : null,
          ordem: args.ordenar_por
            ? { coluna: args.ordenar_por, direcao: args.direcao ?? "asc" }
            : null,
          pagina: args.pagina ?? 0,
        }),
      ),
  );

  servidor.registerTool(
    "buscar_colunas",
    {
      title: "Procurar coluna em todo o banco",
      description:
        "Procura, em todas as tabelas visíveis, colunas cujo nome ou comentário contém o termo (ex.: CNPJ, EAN, PRECO, ESTOQUE, CLIENTE). É o primeiro passo num ERP desconhecido: descobre onde mora cada informação antes de abrir as tabelas.",
      inputSchema: {
        termo: z.string().trim().min(2).max(60),
        limite: z.number().int().min(1).max(300).optional(),
      },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, async (deps) => {
        const colunas = await buscarColunas(deps, args.termo, args.limite);
        return { total: colunas.length, colunas };
      }),
  );

  servidor.registerTool(
    "perfilar_coluna",
    {
      title: "Perfil de uma coluna",
      description:
        "Estatística de UMA coluna, para entender o que ela guarda sem depender de nome: % preenchido, quantos valores distintos, mínimo e máximo, tamanho do texto, os valores mais comuns e os FORMATOS (dígito vira 9, letra vira A/a — '99.999.999/9999-99' é CNPJ com máscara, '9999999999999' é EAN-13). Tabela grande é lida por amostra de blocos (o retorno diz quanto). Coluna em que quase todo valor é único (código, documento, telefone) não lista valores, só formatos. Use para decidir mapeamento e conversão (ex.: se o 'EAN' é um EAN de verdade, se 'S/N' indica bloqueio).",
      inputSchema: {
        schema: nomeNoBanco,
        tabela: nomeNoBanco,
        coluna: nomeNoBanco,
      },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, (deps) =>
        perfilarColuna(deps, {
          tabela: { schema: args.schema, nome: args.tabela },
          coluna: args.coluna,
        }),
      ),
  );

  servidor.registerTool(
    "ligacoes_entre_tabelas",
    {
      title: "Ligações entre tabelas",
      description:
        "Como as tabelas de um schema se ligam: chaves estrangeiras declaradas e ligações inferidas pelo nome da coluna (uma coluna com o mesmo nome da chave primária de outra tabela). ERP antigo quase não declara chave, então as inferidas são o mapa real — mas são convenção, não garantia. Informe 'tabela' para ver só as ligações dela.",
      inputSchema: {
        schema: z.string().max(128).optional(),
        tabela: z.string().max(128).optional(),
      },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, async (deps) => {
        const diagrama = await diagramaDoSchema(deps, args.schema ?? null);
        const alvo = args.tabela
          ? `${diagrama.schema}.${args.tabela.trim().toUpperCase()}`
          : null;
        const ligacoes = diagrama.ligacoes.filter(
          (ligacao) => !alvo || ligacao.de === alvo || ligacao.para === alvo,
        );
        return {
          schema: diagrama.schema,
          schemas: diagrama.schemas,
          total: ligacoes.length,
          ligacoes: ligacoes.map((ligacao) => ({
            de: ligacao.de,
            colunasDe: ligacao.colunasDe,
            para: ligacao.para,
            colunasPara: ligacao.colunasPara,
            origem: ligacao.origem,
          })),
        };
      }),
  );

  servidor.registerTool(
    "estado_do_mapeamento",
    {
      title: "Estado do mapeamento",
      description:
        "Para cada tipo do NERP: modo (auto, manual, desligado), status (pronto, incompleto, indisponível, desligado), a origem em uso, o perfil automático escolhido e os perfis recusados com o motivo.",
      inputSchema: {},
      annotations: SO_LEITURA,
    },
    () => executar(agente, estadoDoMapeamento),
  );

  servidor.registerTool(
    "sugerir_mapeamento",
    {
      title: "Sugerir pelo perfil do ERP",
      description:
        "A origem que o perfil automático do ERP usaria para o tipo, e os perfis que não servem neste banco com o motivo. Bom ponto de partida para montar uma configuração manual.",
      inputSchema: { tipo: tipoDoNerp },
      annotations: SO_LEITURA,
    },
    (args) => executar(agente, (deps) => sugerirMapeamento(deps, args.tipo)),
  );

  servidor.registerTool(
    "validar_mapeamento",
    {
      title: "Validar uma configuração",
      description:
        "Confere uma configuração contra a estrutura real das tabelas, sem ler dados: campos obrigatórios, colunas que existem, tipos compatíveis, junção, janela de data em tabela grande. Devolve status, erros e avisos.",
      inputSchema: { tipo: tipoDoNerp, config: configDoTipoSchema },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, async (deps) =>
        resumir(await resolverTipo(deps, args.tipo, args.config)),
      ),
  );

  servidor.registerTool(
    "testar_mapeamento",
    {
      title: "Testar com dado real",
      description:
        "Lê até 10 linhas pela configuração (ou pela salva, se 'config' não vier) e devolve o que o NERP receberia: os valores já convertidos, os problemas de cada linha e se o código já existe no cadastro do NERP. Sem 'codigo', olha só os últimos 3 dias da janela; com 'codigo', procura aquele item.",
      inputSchema: {
        tipo: tipoDoNerp,
        config: configDoTipoSchema.optional(),
        codigo: z.string().trim().max(40).optional(),
      },
      annotations: SO_LEITURA,
    },
    (args) =>
      executar(agente, (deps) =>
        testarMapeamento(
          deps,
          args.tipo,
          args.config ?? null,
          args.codigo || null,
        ),
      ),
  );

  servidor.registerTool(
    "salvar_mapeamento",
    {
      title: "Salvar o mapeamento de um tipo",
      description:
        "Grava a configuração de UM tipo para esta organização (os outros tipos não mudam). Configuração manual só é gravada se passar na validação. Só chame depois de testar e de o usuário confirmar o resultado.",
      inputSchema: { tipo: tipoDoNerp, config: configDoTipoSchema },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args) =>
      executar(agente, (deps) =>
        salvarMapeamento(deps, args.tipo, args.config),
      ),
  );

  servidor.registerPrompt(
    "mapear_banco",
    {
      title: "Mapear o banco do ERP",
      description:
        "Roteiro para mapear, com o usuário, de onde vêm os dados do NERP no banco do ERP deste cliente.",
      argsSchema: {
        tipo: z
          .string()
          .optional()
          .describe("Opcional: começar por um tipo (ex.: produto, cliente)"),
      },
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: roteiroDeMapeamento(args.tipo),
          },
        },
      ],
    }),
  );
}

function roteiroDeMapeamento(tipo: string | undefined): string {
  const foco = tipo
    ? `Comece pelo tipo "${tipo}" e só depois passe aos outros.`
    : "Passe por todos os tipos, na ordem: produto, categoria, cliente, estoque, preço, promoção.";
  return [
    "Quero mapear o banco do ERP deste cliente para o NERP. Conduza comigo, em português:",
    "1. Chame conexao_do_banco e tipos_do_nerp para entender o banco e o que o NERP precisa.",
    "2. Chame estado_do_mapeamento e me mostre, em uma tabela curta, o status de cada tipo.",
    `3. ${foco}`,
    "4. Para cada tipo que não estiver 'pronto' (ou que eu quiser revisar): use sugerir_mapeamento; se o perfil não servir — ou se o ERP for desconhecido —, investigue: buscar_colunas pelo que procura (CNPJ, EAN, PRECO…), descrever_tabela, ligacoes_entre_tabelas, perfilar_coluna nas colunas candidatas e amostrar_tabela para ver linhas.",
    "4b. Mesmo num tipo 'pronto', confira com perfilar_coluna as colunas que podem enganar: código de barras (é EAN válido ou o código interno repetido?), documento (tem máscara?), quantidades (o estoque é total ou disponível?) e colunas S/N (é bloqueio ou inativo?). Escolha a conversão certa em tipos_do_nerp.",
    "5. Monte a configuração, rode validar_mapeamento e corrija até não ter erro.",
    "6. Rode testar_mapeamento com um código que eu reconheça (pergunte qual) e me mostre o resultado.",
    "7. Só chame salvar_mapeamento depois que eu confirmar.",
    "Regras: o banco do ERP é só leitura; não invente nome de tabela ou coluna (sempre confira com descrever_tabela); em tabela grande use filtro/janela na primeira coluna de um índice; explique cada escolha em uma frase.",
  ].join("\n");
}
