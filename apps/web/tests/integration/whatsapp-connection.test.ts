import { call } from "@orpc/server";
import type { Organization, User } from "@/generated/prisma/client";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createFunnel } from "@/app/router/crm/create-funnel";
import { listFunnels } from "@/app/router/crm/list-funnels";
import { getConnection } from "@/app/router/whatsapp/get-connection";
import { removeConnection } from "@/app/router/whatsapp/remove-connection";
import { saveConnection } from "@/app/router/whatsapp/save-connection";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * Conexão de WhatsApp — isolamento entre organizações e sigilo da credencial.
 *
 * É a suíte que existe porque o projeto de origem não tinha: lá o funil chega
 * do cliente e é usado sem confronto com a organização. Aqui cada teste tenta
 * exatamente esse atalho.
 *
 * Segue a forma de `integracoes-list.test.ts`: duas organizações, dados nas
 * duas, e a asserção de que uma não alcança a outra.
 */

const TOKEN_DA_A = "EAAtoken-super-secreto-da-org-A-9876";
const APP_SECRET_DA_A = "appsecret-da-org-A-5432";

let orgA: Organization;
let orgB: Organization;
let adminA: User;
let adminB: User;
let comumA: User;
let funilA: string;
let funilB: string;

beforeAll(async () => {
  await resetDb();

  orgA = await createOrg("Rede A");
  orgB = await createOrg("Rede B");

  adminA = await createUser();
  adminB = await createUser();
  comumA = await createUser();

  await createMember(adminA, orgA);
  await createMember(adminB, orgB);
  // Membro comum: entra na organização A sem cargo de administrador.
  await prisma.member.create({
    data: { organizationId: orgA.id, userId: comumA.id, role: "member" },
  });

  const criadoA = await call(
    createFunnel,
    { name: "Vendas" },
    { context: s2sContext(adminA, orgA) },
  );
  const criadoB = await call(
    createFunnel,
    { name: "Vendas" },
    { context: s2sContext(adminB, orgB) },
  );
  funilA = criadoA.id;
  funilB = criadoB.id;

  await call(
    saveConnection,
    {
      funnelId: funilA,
      name: "Número da A",
      phoneNumberId: "111111111",
      businessAccountId: "222222222",
      accessToken: TOKEN_DA_A,
      appSecret: APP_SECRET_DA_A,
      verifyToken: "verify-da-A",
    },
    { context: s2sContext(adminA, orgA) },
  );
});

afterAll(resetDb);

describe("crm.funnel.create", () => {
  it("já cria o funil com os estágios padrão", async () => {
    // Funil sem estágio não recebe lead: a mensagem de um número desconhecido
    // chegaria e não teria coluna onde pousar.
    const estagios = await prisma.crmStage.count({
      where: { funnelId: funilA, organizationId: orgA.id },
    });
    expect(estagios).toBeGreaterThan(0);
  });
});

describe("crm.funnel.list", () => {
  it("devolve só os funis da organização do contexto", async () => {
    const resultado = await call(
      listFunnels,
      {},
      { context: s2sContext(adminA, orgA) },
    );
    expect(resultado.funis.map((f) => f.id)).toEqual([funilA]);
  });
});

describe("whatsapp.connection.get", () => {
  it("devolve a conexão para quem é admin da organização dona", async () => {
    const resultado = await call(
      getConnection,
      { funnelId: funilA },
      { context: s2sContext(adminA, orgA) },
    );
    expect(resultado.conexao?.name).toBe("Número da A");
    expect(resultado.podeGerenciar).toBe(true);
  });

  it("nunca devolve o segredo em claro", async () => {
    const resultado = await call(
      getConnection,
      { funnelId: funilA },
      { context: s2sContext(adminA, orgA) },
    );
    const serializado = JSON.stringify(resultado);
    expect(serializado).not.toContain(TOKEN_DA_A);
    expect(serializado).not.toContain(APP_SECRET_DA_A);
  });

  it("mascara o segredo mostrando só os quatro últimos", async () => {
    const resultado = await call(
      getConnection,
      { funnelId: funilA },
      { context: s2sContext(adminA, orgA) },
    );
    expect(resultado.conexao?.credenciais.accessToken).toBe("••••9876");
    expect(resultado.conexao?.credenciais.appSecret).toBe("••••5432");
    // Identificador público volta inteiro — é o que o operador confere.
    expect(resultado.conexao?.credenciais.phoneNumberId).toBe("111111111");
  });

  it("esconde as credenciais de quem não é admin", async () => {
    const resultado = await call(
      getConnection,
      { funnelId: funilA },
      { context: s2sContext(comumA, orgA) },
    );
    expect(resultado.podeGerenciar).toBe(false);
    expect(resultado.conexao?.credenciais.accessToken).toBeNull();
    expect(resultado.conexao?.credenciais.appSecret).toBeNull();
  });

  it("recusa funil de outra organização com NOT_FOUND", async () => {
    // NOT_FOUND e não FORBIDDEN: dizer "existe, mas não é seu" já entrega que
    // o id existe.
    await expect(
      call(
        getConnection,
        { funnelId: funilA },
        { context: s2sContext(adminB, orgB) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("whatsapp.connection.save", () => {
  it("mantém o segredo guardado quando o campo vem em branco", async () => {
    // Salvar só para trocar o nome não pode zerar o token e derrubar o
    // atendimento.
    await call(
      saveConnection,
      {
        funnelId: funilA,
        name: "Número da A (renomeado)",
        phoneNumberId: "111111111",
        businessAccountId: "222222222",
        accessToken: "",
        appSecret: "",
        verifyToken: "",
      },
      { context: s2sContext(adminA, orgA) },
    );

    const resultado = await call(
      getConnection,
      { funnelId: funilA },
      { context: s2sContext(adminA, orgA) },
    );
    expect(resultado.conexao?.name).toBe("Número da A (renomeado)");
    expect(resultado.conexao?.credenciais.accessToken).toBe("••••9876");
  });

  it("recusa reaproveitar um Phone Number ID já usado em outro funil", async () => {
    // O id do número é único na plataforma: é a chave pela qual o webhook
    // descobre de quem é a mensagem. Duas conexões com o mesmo id fariam a
    // conversa cair na organização errada.
    await expect(
      call(
        saveConnection,
        {
          funnelId: funilB,
          name: "Tentativa da B",
          phoneNumberId: "111111111",
          accessToken: "token-da-B",
        },
        { context: s2sContext(adminB, orgB) },
      ),
    ).rejects.toThrow(/já está conectado/i);
  });

  it("recusa quem não é admin", async () => {
    await expect(
      call(
        saveConnection,
        {
          funnelId: funilA,
          name: "Tentativa",
          phoneNumberId: "111111111",
          accessToken: "outro-token",
        },
        { context: s2sContext(comumA, orgA) },
      ),
    ).rejects.toThrow(/administradores/i);
  });
});

describe("whatsapp.connection.remove", () => {
  it("não apaga a conexão de outra organização", async () => {
    await expect(
      call(
        removeConnection,
        { funnelId: funilA },
        { context: s2sContext(adminB, orgB) },
      ),
    ).rejects.toThrow(/não encontrado/i);

    // E a linha continua lá — a asserção que pega um `deleteMany` sem filtro
    // de organização.
    const aindaExiste = await prisma.whatsAppConnection.count({
      where: { funnelId: funilA, organizationId: orgA.id },
    });
    expect(aindaExiste).toBe(1);
  });
});
