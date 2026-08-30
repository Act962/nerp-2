import { call } from "@orpc/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createWorkflow } from "@/app/router/automacoes/create";
import { getWorkflow } from "@/app/router/automacoes/get";
import { listRuns } from "@/app/router/automacoes/list-runs";
import { listWorkflows } from "@/app/router/automacoes/list";
import { saveGraph } from "@/app/router/automacoes/save-graph";
import { toggleWorkflow } from "@/app/router/automacoes/toggle";
import { createFunnel } from "@/app/router/crm/create-funnel";
import { executarNo } from "@/features/automacoes/server/executar-no";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * Automações do funil.
 *
 * O que estes testes prendem: o grafo só liga quando roda de verdade, os
 * passos mexem no lead certo da organização certa, e nada configurado por um
 * operador alcança outro tenant nem a rede interna.
 */

let org: Organization;
let outraOrg: Organization;
let dono: User;
let vizinho: User;
let funnelId: string;
let stageId: string;
let leadId: string;

const ctx = () => ({ context: s2sContext(dono, org) });
const doVizinho = () => ({ context: s2sContext(vizinho, outraOrg) });

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja com automação");
  outraOrg = await createOrg("Loja vizinha");
  dono = await createUser();
  vizinho = await createUser();
  await createMember(dono, org);
  await createMember(vizinho, outraOrg);

  const funil = await call(createFunnel, { name: "Atendimento" }, ctx());
  funnelId = funil.id;
  const etapas = await prisma.crmStage.findMany({
    where: { funnelId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  stageId = etapas[2].id;
});

beforeEach(async () => {
  await prisma.crmWorkflow.deleteMany({ where: { organizationId: org.id } });
  await prisma.crmLead.deleteMany({ where: { organizationId: org.id } });

  const primeiraEtapa = await prisma.crmStage.findFirstOrThrow({
    where: { funnelId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const lead = await prisma.crmLead.create({
    data: {
      organizationId: org.id,
      funnelId,
      stageId: primeiraEtapa.id,
      name: "Marina Souza",
      phone: "+5511999990000",
      temperature: "COLD",
      amount: 500,
    },
    select: { id: true },
  });
  leadId = lead.id;
});

afterAll(resetDb);

async function novaAutomacao(nome = "Boas-vindas"): Promise<string> {
  const criada = await call(
    createWorkflow,
    { funnelId, name: nome, gatilho: "TRIGGER_NEW_LEAD" },
    ctx(),
  );
  return criada.id;
}

describe("criação", () => {
  it("nasce desligada e com o gatilho escolhido", async () => {
    const id = await novaAutomacao();
    const automacao = await call(getWorkflow, { workflowId: id }, ctx());

    // Ligada de saída mandaria mensagem para cliente antes de alguém ler o que
    // ela faz.
    expect(automacao.isActive).toBe(false);
    expect(automacao.nos).toHaveLength(1);
    expect(automacao.nos[0].type).toBe("TRIGGER_NEW_LEAD");
  });

  it("exige os minutos no gatilho de silêncio", async () => {
    await expect(
      call(
        createWorkflow,
        { funnelId, name: "Sem resposta", gatilho: "TRIGGER_LEAD_IDLE" },
        ctx(),
      ),
    ).rejects.toThrow(/minutos/i);
  });

  it("recusa funil de outra organização", async () => {
    await expect(
      call(
        createWorkflow,
        { funnelId, name: "Invasora", gatilho: "TRIGGER_NEW_LEAD" },
        doVizinho(),
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("gravação do grafo", () => {
  it("devolve os ids definitivos dos passos do editor", async () => {
    const id = await novaAutomacao();
    const { ids } = await call(
      saveGraph,
      {
        workflowId: id,
        nos: [
          {
            id: "temp-1",
            type: "TRIGGER_NEW_LEAD",
            name: "Lead novo",
            position: { x: 0, y: 0 },
            data: {},
          },
          {
            id: "temp-2",
            type: "SET_TEMPERATURE",
            name: "Esquentar",
            position: { x: 0, y: 120 },
            data: { temperatura: "WARM" },
          },
        ],
        arestas: [
          { fromNodeId: "temp-1", toNodeId: "temp-2", fromOutput: "main" },
        ],
      },
      ctx(),
    );

    expect(Object.keys(ids)).toEqual(["temp-1", "temp-2"]);
    const automacao = await call(getWorkflow, { workflowId: id }, ctx());
    expect(automacao.nos).toHaveLength(2);
    expect(automacao.arestas).toHaveLength(1);
  });

  it("recusa dois gatilhos", async () => {
    const id = await novaAutomacao();
    await expect(
      call(
        saveGraph,
        {
          workflowId: id,
          nos: [
            {
              id: "a",
              type: "TRIGGER_NEW_LEAD",
              name: "A",
              position: { x: 0, y: 0 },
              data: {},
            },
            {
              id: "b",
              type: "TRIGGER_MESSAGE_IN",
              name: "B",
              position: { x: 0, y: 0 },
              data: {},
            },
          ],
          arestas: [],
        },
        ctx(),
      ),
    ).rejects.toThrow(/um gatilho/i);
  });

  it("recusa ligação para passo que não está no desenho", async () => {
    const id = await novaAutomacao();
    await expect(
      call(
        saveGraph,
        {
          workflowId: id,
          nos: [
            {
              id: "a",
              type: "TRIGGER_NEW_LEAD",
              name: "A",
              position: { x: 0, y: 0 },
              data: {},
            },
          ],
          arestas: [
            { fromNodeId: "a", toNodeId: "fantasma", fromOutput: "main" },
          ],
        },
        ctx(),
      ),
    ).rejects.toThrow(/não está no desenho/i);
  });

  it("a organização vizinha não grava no grafo alheio", async () => {
    const id = await novaAutomacao();
    await expect(
      call(
        saveGraph,
        {
          workflowId: id,
          nos: [
            {
              id: "a",
              type: "TRIGGER_NEW_LEAD",
              name: "A",
              position: { x: 0, y: 0 },
              data: {},
            },
          ],
          arestas: [],
        },
        doVizinho(),
      ),
    ).rejects.toThrow(/não encontrada/i);
  });
});

describe("ligar e desligar", () => {
  async function comGrafoValido(): Promise<string> {
    const id = await novaAutomacao();
    await call(
      saveGraph,
      {
        workflowId: id,
        nos: [
          {
            id: "g",
            type: "TRIGGER_NEW_LEAD",
            name: "Lead novo",
            position: { x: 0, y: 0 },
            data: {},
          },
          {
            id: "t",
            type: "SET_TEMPERATURE",
            name: "Esquentar",
            position: { x: 0, y: 120 },
            data: { temperatura: "WARM" },
          },
        ],
        arestas: [{ fromNodeId: "g", toNodeId: "t", fromOutput: "main" }],
      },
      ctx(),
    );
    return id;
  }

  it("liga quando o grafo roda", async () => {
    const id = await comGrafoValido();
    const resultado = await call(
      toggleWorkflow,
      { workflowId: id, isActive: true },
      ctx(),
    );
    expect(resultado.isActive).toBe(true);
  });

  it("recusa ligar com o gatilho sem saída", async () => {
    const id = await novaAutomacao();
    // Automação ligada que nunca dispara é pior que desligada: o operador acha
    // que resolveu.
    await expect(
      call(toggleWorkflow, { workflowId: id, isActive: true }, ctx()),
    ).rejects.toThrow(/nenhum passo/i);
  });

  it("desliga mesmo com o desenho quebrado", async () => {
    const id = await comGrafoValido();
    await call(toggleWorkflow, { workflowId: id, isActive: true }, ctx());

    // Quebra o grafo por baixo, como aconteceria se alguém apagasse uma etapa.
    await prisma.crmWorkflowConnection.deleteMany({
      where: { workflowId: id },
    });

    const resultado = await call(
      toggleWorkflow,
      { workflowId: id, isActive: false },
      ctx(),
    );
    expect(resultado.isActive).toBe(false);
  });
});

describe("execução dos passos", () => {
  const contexto = () => ({
    organizationId: org.id,
    funnelId,
    workflowId: "wf",
    leadId,
    autorId: dono.id,
    textoDaMensagem: "quero orçamento",
  });

  it("muda a temperatura do lead", async () => {
    const resultado = await executarNo(
      {
        id: "n",
        type: "SET_TEMPERATURE",
        name: "Esquentar",
        data: { temperatura: "HOT" },
      },
      contexto(),
    );

    expect(resultado.tipo).toBe("seguiu");
    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { temperature: true },
    });
    expect(lead.temperature).toBe("HOT");
  });

  it("move de etapa e registra a entrada", async () => {
    await executarNo(
      { id: "n", type: "MOVE_STAGE", name: "Mover", data: { stageId } },
      contexto(),
    );

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { stageId: true, stageEnteredAt: true },
    });
    expect(lead.stageId).toBe(stageId);
    expect(lead.stageEnteredAt).not.toBeNull();
  });

  it("recusa etapa de outro funil", async () => {
    const outroFunil = await call(createFunnel, { name: "Outro" }, ctx());
    const etapaDeFora = await prisma.crmStage.findFirstOrThrow({
      where: { funnelId: outroFunil.id },
      select: { id: true },
    });

    const resultado = await executarNo(
      {
        id: "n",
        type: "MOVE_STAGE",
        name: "Mover",
        data: { stageId: etapaDeFora.id },
      },
      contexto(),
    );

    expect(resultado).toMatchObject({ tipo: "falhou" });
    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { stageId: true },
    });
    expect(lead.stageId).not.toBe(etapaDeFora.id);
  });

  it("não atribui responsável de fora da equipe", async () => {
    const resultado = await executarNo(
      {
        id: "n",
        type: "SET_RESPONSIBLE",
        name: "Atribuir",
        data: { userId: vizinho.id },
      },
      contexto(),
    );

    expect(resultado).toMatchObject({ tipo: "falhou" });
    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { responsibleId: true },
    });
    expect(lead.responsibleId).toBeNull();
  });

  it("o filtro escolhe a porta pelo estado do lead", async () => {
    const quente = await executarNo(
      {
        id: "f",
        type: "FILTER",
        name: "É quente?",
        data: {
          condicao: { campo: "temperatura", operador: "igual", valor: "COLD" },
        },
      },
      contexto(),
    );
    expect(quente).toMatchObject({ tipo: "seguiu", saida: "sim" });

    const naoQuente = await executarNo(
      {
        id: "f",
        type: "FILTER",
        name: "É quente?",
        data: {
          condicao: { campo: "temperatura", operador: "igual", valor: "HOT" },
        },
      },
      contexto(),
    );
    expect(naoQuente).toMatchObject({ tipo: "seguiu", saida: "nao" });
  });

  it("o filtro enxerga o texto que disparou", async () => {
    const resultado = await executarNo(
      {
        id: "f",
        type: "FILTER",
        name: "Falou em orçamento?",
        data: {
          condicao: {
            campo: "texto_da_mensagem",
            operador: "contem",
            valor: "orçamento",
          },
        },
      },
      contexto(),
    );
    expect(resultado).toMatchObject({ saida: "sim" });
  });

  it("marca ganho e encerra o lead", async () => {
    await executarNo(
      {
        id: "n",
        type: "SET_WIN_LOSS",
        name: "Ganho",
        data: { resultado: "WON" },
      },
      contexto(),
    );

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { currentAction: true, statusFlow: true },
    });
    expect(lead.currentAction).toBe("WON");
    expect(lead.statusFlow).toBe("FINISHED");
  });

  it("para — em vez de falhar — quando o contato não tem conversa", async () => {
    const resultado = await executarNo(
      { id: "n", type: "SEND_MESSAGE", name: "Oi", data: { texto: "Olá!" } },
      contexto(),
    );
    expect(resultado).toMatchObject({ tipo: "parou" });
  });
});

describe("webhook do nó HTTP", () => {
  it("recusa endereço da rede interna", async () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:5432/",
      "http://192.168.0.10/webhook",
      "http://localhost/webhook",
      "file:///etc/passwd",
    ]) {
      const resultado = await executarNo(
        {
          id: "n",
          type: "HTTP_REQUEST",
          name: "Avisar",
          data: { url, metodo: "POST" },
        },
        {
          organizationId: org.id,
          funnelId,
          workflowId: "wf",
          leadId,
          autorId: dono.id,
          textoDaMensagem: null,
        },
      );
      // O servidor do nerp faria essa chamada de dentro da própria rede.
      expect(resultado, url).toMatchObject({ tipo: "falhou" });
    }
  });
});

describe("histórico", () => {
  it("só mostra as execuções da própria organização", async () => {
    const id = await novaAutomacao();
    await prisma.crmWorkflowRun.create({
      data: {
        organizationId: org.id,
        workflowId: id,
        leadId,
        triggerType: "TRIGGER_NEW_LEAD",
        status: "SUCCESS",
        nodesExecuted: 2,
        finishedAt: new Date(),
      },
    });

    const meu = await call(listRuns, { workflowId: id, limite: 10 }, ctx());
    expect(meu.execucoes).toHaveLength(1);
    expect(meu.execucoes[0].leadNome).toBe("Marina Souza");

    await expect(
      call(listRuns, { workflowId: id, limite: 10 }, doVizinho()),
    ).rejects.toThrow(/não encontrada/i);
  });

  it("a lista conta passos e execuções recentes", async () => {
    const id = await novaAutomacao("Com passos");
    await call(
      saveGraph,
      {
        workflowId: id,
        nos: [
          {
            id: "g",
            type: "TRIGGER_NEW_LEAD",
            name: "G",
            position: { x: 0, y: 0 },
            data: {},
          },
          {
            id: "a",
            type: "WAIT",
            name: "Esperar",
            position: { x: 0, y: 1 },
            data: { minutos: 10 },
          },
          {
            id: "b",
            type: "SET_TEMPERATURE",
            name: "T",
            position: { x: 0, y: 2 },
            data: { temperatura: "WARM" },
          },
        ],
        arestas: [
          { fromNodeId: "g", toNodeId: "a", fromOutput: "main" },
          { fromNodeId: "a", toNodeId: "b", fromOutput: "main" },
        ],
      },
      ctx(),
    );

    const lista = await call(listWorkflows, { funnelId }, ctx());
    const minha = lista.automacoes.find((a) => a.id === id);
    expect(minha?.passos).toBe(2);
    expect(minha?.gatilho).toBe("TRIGGER_NEW_LEAD");

    // E a vizinha não vê nenhuma.
    const daVizinha = await call(listWorkflows, {}, doVizinho());
    expect(daVizinha.automacoes).toHaveLength(0);
  });
});

describe("disparo", () => {
  it("não dispara automação desligada, e a ligada entra na fila", async () => {
    const { dispararAutomacoes } = await import(
      "@/features/automacoes/server/disparar"
    );
    const { inngest } = await import("@/lib/inngest/client");
    const enviar = vi.spyOn(inngest, "send").mockResolvedValue({ ids: [] });

    const id = await novaAutomacao("Na fila");
    await call(
      saveGraph,
      {
        workflowId: id,
        nos: [
          {
            id: "g",
            type: "TRIGGER_NEW_LEAD",
            name: "G",
            position: { x: 0, y: 0 },
            data: {},
          },
          {
            id: "t",
            type: "SET_TEMPERATURE",
            name: "T",
            position: { x: 0, y: 1 },
            data: { temperatura: "WARM" },
          },
        ],
        arestas: [{ fromNodeId: "g", toNodeId: "t", fromOutput: "main" }],
      },
      ctx(),
    );

    const desligada = await dispararAutomacoes({
      organizationId: org.id,
      funnelId,
      leadId,
      gatilho: "TRIGGER_NEW_LEAD",
    });
    expect(desligada.disparadas).toBe(0);

    await call(toggleWorkflow, { workflowId: id, isActive: true }, ctx());

    const ligada = await dispararAutomacoes({
      organizationId: org.id,
      funnelId,
      leadId,
      gatilho: "TRIGGER_NEW_LEAD",
    });
    expect(ligada.disparadas).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(1);

    // A execução é gravada ANTES do evento: se a publicação falhar, sobra
    // rastro em vez de sumiço.
    const execucoes = await prisma.crmWorkflowRun.count({
      where: { workflowId: id },
    });
    expect(execucoes).toBe(1);

    enviar.mockRestore();
  });

  it("gatilho diferente não acorda a automação", async () => {
    const { dispararAutomacoes } = await import(
      "@/features/automacoes/server/disparar"
    );
    const id = await novaAutomacao("Só lead novo");
    await call(
      saveGraph,
      {
        workflowId: id,
        nos: [
          {
            id: "g",
            type: "TRIGGER_NEW_LEAD",
            name: "G",
            position: { x: 0, y: 0 },
            data: {},
          },
          {
            id: "t",
            type: "SET_TEMPERATURE",
            name: "T",
            position: { x: 0, y: 1 },
            data: { temperatura: "WARM" },
          },
        ],
        arestas: [{ fromNodeId: "g", toNodeId: "t", fromOutput: "main" }],
      },
      ctx(),
    );
    await call(toggleWorkflow, { workflowId: id, isActive: true }, ctx());

    const resultado = await dispararAutomacoes({
      organizationId: org.id,
      funnelId,
      leadId,
      gatilho: "TRIGGER_STAGE_CHANGED",
    });
    expect(resultado.disparadas).toBe(0);
  });
});
