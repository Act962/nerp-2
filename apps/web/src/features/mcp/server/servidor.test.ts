import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependencias } from "@/features/mapeamento-banco/application/dependencias";
import {
  PCPEDC,
  PCPEDI,
  PCPRODUT,
  resumo,
} from "@/features/mapeamento-banco/domain/fixtures";
import { mapeamentoVazio } from "@/features/mapeamento-banco/domain/mapeamento";
import {
  ESCOPO_IMPORTACAO,
  ESCOPO_MAPEAMENTO,
  type EscopoDoMcp,
} from "../escopos";
import type { AgenteAutenticado } from "./autenticar";
import { criarServidorMcp } from "./servidor";

// Banco falso no lugar do Oracle: o teste exercita o protocolo MCP de ponta a
// ponta (cliente → servidor → caso de uso) sem rede nem ERP.
const tabelas = [PCPRODUT, PCPEDI, PCPEDC];
const deps: Dependencias = {
  banco: {
    descricao: {
      motor: "oracle",
      rotuloDoMotor: "Oracle",
      schemaPrincipal: "LGCARVALHO",
      servidor: "erp:1521/X",
    },
    testarConexao: async () => {},
    listarTabelas: async () => tabelas.map(resumo),
    descreverTabela: async (ref) =>
      tabelas.find((t) => t.schema === ref.schema && t.nome === ref.nome) ??
      null,
    descreverSchema: async (schema) =>
      tabelas.filter((t) => t.schema === schema),
    amostrar: async () => ({
      colunas: [],
      linhas: [],
      temMais: false,
      tempoMs: 0,
    }),
    perfilarColuna: async () => ({
      linhasAnalisadas: 100,
      preenchidas: 90,
      distintos: 3,
      minimo: "A",
      maximo: "C",
      tamanhoMinimo: 1,
      tamanhoMaximo: 1,
      maisComuns: [{ valor: "A", quantidade: 50 }],
      formatos: [{ formato: "A", quantidade: 90 }],
      tempoMs: 1,
    }),
    buscarColunas: async () => [],
    lerMapeado: async () => [],
    esquecerEstrutura: () => {},
    explicarFalha: () => "falhou",
  },
  vocabulario: {
    nome: "Winthor",
    tabela: () => null,
    coluna: () => null,
    perfis: () => [],
  },
  repositorio: {
    carregar: async () => mapeamentoVazio(),
    salvar: async () => {},
  },
  nerp: { codigosExistentes: async () => null },
  destino: {
    produtosLocais: async () => [],
    aplicarProdutos: async () => ({ gravados: 0, falhas: [] }),
    clientesLocais: async () => [],
    aplicarClientes: async () => ({ gravados: 0, falhas: [] }),
    produtosVinculados: async () => new Map(),
    filialDoEstoque: async () => null,
    substituirEstoque: async () => ({ produtosAtualizados: 0 }),
  },
};

vi.mock("@/features/mapeamento-banco/server/compor", () => ({
  SemBancoExterno: class SemBancoExterno extends Error {},
  dependenciasDaOrg: async () => deps,
}));

function agente(habilidades: EscopoDoMcp[]): AgenteAutenticado {
  return {
    organizationId: "org-1",
    usuario: { id: "u-1", email: "dev@nasaerp.com", name: "Dev" },
    tokenId: "t-1",
    habilidades,
  };
}

async function conectar(habilidades: EscopoDoMcp[]) {
  const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
  await criarServidorMcp(agente(habilidades)).connect(doServidor);
  const cliente = new Client({ name: "teste", version: "1.0.0" });
  await cliente.connect(doCliente);
  return cliente;
}

function textoDe(resultado: Awaited<ReturnType<Client["callTool"]>>) {
  const [primeiro] = resultado.content as { type: string; text: string }[];
  return primeiro.text;
}

describe("servidor MCP do NERP", () => {
  let cliente: Client;
  beforeEach(async () => {
    cliente = await conectar([ESCOPO_MAPEAMENTO]);
  });

  it("expõe as ferramentas da habilidade de mapeamento", async () => {
    const { tools } = await cliente.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "conexao_do_banco",
      "tipos_do_nerp",
      "listar_tabelas",
      "descrever_tabela",
      "amostrar_tabela",
      "buscar_colunas",
      "perfilar_coluna",
      "ligacoes_entre_tabelas",
      "estado_do_mapeamento",
      "sugerir_mapeamento",
      "validar_mapeamento",
      "testar_mapeamento",
      "salvar_mapeamento",
    ]);
    const salvar = tools.find((tool) => tool.name === "salvar_mapeamento");
    expect(salvar?.annotations?.readOnlyHint).toBe(false);
  });

  it("entrega o contrato do NERP, com cliente", async () => {
    const resultado = await cliente.callTool({
      name: "tipos_do_nerp",
      arguments: {},
    });
    const contrato = JSON.parse(textoDe(resultado));
    expect(contrato.tipos.map((tipo: { tipo: string }) => tipo.tipo)).toContain(
      "cliente",
    );
  });

  it("devolve a regra de tabela grande como erro da ferramenta", async () => {
    const resultado = await cliente.callTool({
      name: "amostrar_tabela",
      arguments: {
        schema: "LGCARVALHO",
        tabela: "PCPEDI",
        filtro_coluna: "PTABELA",
        filtro_valor: "1",
      },
    });
    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).toContain("não abre nenhum índice");
  });

  it("valida a configuração sem ler dado", async () => {
    const resultado = await cliente.callTool({
      name: "validar_mapeamento",
      arguments: {
        tipo: "produto",
        config: {
          modo: "manual",
          origem: {
            tabela: { schema: "LGCARVALHO", nome: "PCPRODUT" },
            colunas: { codigo: { de: "base", nome: "CODPROD" } },
          },
        },
      },
    });
    const resumo = JSON.parse(textoDe(resultado));
    expect(resumo.status).toBe("incompleto");
    expect(resumo.diagnostico.erros).toContain('"Nome" é obrigatório.');
  });

  it("perfila coluna e esconde valores comuns de identificador", async () => {
    const resultado = await cliente.callTool({
      name: "perfilar_coluna",
      arguments: {
        schema: "LGCARVALHO",
        tabela: "PCPRODUT",
        coluna: "UNIDADE",
      },
    });
    const perfil = JSON.parse(textoDe(resultado));
    expect(perfil.amostra.completa).toBe(true);
    expect(perfil.maisComuns).toEqual([{ valor: "A", quantidade: 50 }]);
    expect(perfil.formatos[0].formato).toBe("A");
  });

  it("oferece o roteiro guiado", async () => {
    const prompt = await cliente.getPrompt({
      name: "mapear_banco",
      arguments: { tipo: "cliente" },
    });
    const [mensagem] = prompt.messages;
    expect(mensagem.content.type).toBe("text");
    if (mensagem.content.type === "text") {
      expect(mensagem.content.text).toContain('"cliente"');
    }
  });

  it("sem habilidade, não expõe ferramenta nenhuma", async () => {
    const semNada = await conectar([]);
    await expect(semNada.listTools()).rejects.toThrow();
  });

  it("sem o escopo de importação, não oferece gravar no NERP", async () => {
    const { tools } = await cliente.listTools();
    const nomes = tools.map((tool) => tool.name);
    expect(nomes).not.toContain("importar");
    expect(nomes).not.toContain("simular_importacao");
  });
});

describe("habilidade de importação", () => {
  it("com o escopo, expõe simular e importar", async () => {
    const cliente = await conectar([ESCOPO_MAPEAMENTO, ESCOPO_IMPORTACAO]);
    const { tools } = await cliente.listTools();
    const importar = tools.find((tool) => tool.name === "importar");
    expect(tools.map((tool) => tool.name)).toContain("simular_importacao");
    expect(importar?.annotations?.readOnlyHint).toBe(false);
    expect(cliente.getInstructions()).toContain("importação");
  });

  it("não importa sem a confirmação explícita", async () => {
    const aplicar = vi.spyOn(deps.destino, "aplicarProdutos");
    const cliente = await conectar([ESCOPO_IMPORTACAO]);
    const resultado = await cliente.callTool({
      name: "importar",
      arguments: { tipo: "produto" },
    });
    expect(resultado.isError).toBe(true);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it("devolve como erro da ferramenta o tipo ainda não mapeado", async () => {
    const cliente = await conectar([ESCOPO_IMPORTACAO]);
    const resultado = await cliente.callTool({
      name: "simular_importacao",
      arguments: { tipo: "cliente" },
    });
    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).toContain("não está pronto");
  });
});
