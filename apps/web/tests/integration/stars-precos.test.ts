import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listRules } from "@/app/router/stars/list-rules";
import { setRule } from "@/app/router/stars/set-rule";
import { ACOES, cobrarAcao, creditar } from "@/features/stars/server/debitar";
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
 * Preço das ações — a tela que liga a cobrança.
 *
 * O que estes testes prendem: só administrador muda preço, a lista aparece
 * mesmo antes de existir regra gravada (senão não haveria como cadastrar a
 * primeira), e o preço definido aqui é o que o motor de débito passa a usar.
 */

let org: Organization;
let outraOrg: Organization;
let admin: User;
let comum: User;
let vizinho: User;

const doAdmin = () => ({ context: s2sContext(admin, org) });
const doComum = () => ({ context: s2sContext(comum, org) });
const doVizinho = () => ({ context: s2sContext(vizinho, outraOrg) });

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja que cobra");
  outraOrg = await createOrg("Loja vizinha");
  admin = await createUser();
  comum = await createUser();
  vizinho = await createUser();

  await createMember(admin, org);
  await createMember(vizinho, outraOrg);
  await prisma.member.create({
    data: { organizationId: org.id, userId: comum.id, role: "member" },
  });
});

beforeEach(async () => {
  await prisma.starRule.deleteMany({
    where: { organizationId: { in: [org.id, outraOrg.id] } },
  });
  await prisma.starTransaction.deleteMany({
    where: { organizationId: org.id },
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { starsBalance: 0 },
  });
});

afterAll(resetDb);

describe("listagem", () => {
  it("mostra as ações mesmo sem nenhuma regra gravada", async () => {
    const resultado = await call(listRules, {}, doAdmin());

    // Uma tela que só lista o que já existe não deixa cadastrar o primeiro
    // preço — e o primeiro preço é o que liga a cobrança.
    expect(resultado.regras.length).toBeGreaterThan(0);
    expect(resultado.regras.every((r) => r.stars === 0)).toBe(true);
    expect(resultado.cobrancaAtiva).toBe(false);
  });

  it("diz quem pode editar", async () => {
    expect((await call(listRules, {}, doAdmin())).podeEditar).toBe(true);
    expect((await call(listRules, {}, doComum())).podeEditar).toBe(false);
  });

  it("a organização vizinha não enxerga os preços desta", async () => {
    await call(
      setRule,
      { actionKey: ACOES.mensagemEnviada, stars: 7 },
      doAdmin(),
    );

    const dela = await call(listRules, {}, doVizinho());
    expect(dela.regras.every((r) => r.stars === 0)).toBe(true);
    expect(dela.cobrancaAtiva).toBe(false);
  });
});

describe("definição do preço", () => {
  it("só administrador muda", async () => {
    await expect(
      call(setRule, { actionKey: ACOES.mensagemEnviada, stars: 3 }, doComum()),
    ).rejects.toThrow(/administradores/i);

    expect(
      await prisma.starRule.count({ where: { organizationId: org.id } }),
    ).toBe(0);
  });

  it("recusa ação que não existe no catálogo", async () => {
    await expect(
      call(setRule, { actionKey: "acao_inventada", stars: 5 }, doAdmin()),
    ).rejects.toThrow(/desconhecida/i);
  });

  it("ligar a cobrança faz o motor passar a debitar", async () => {
    // Antes: sem preço, nada é cobrado nem bloqueado.
    const antes = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem",
    });
    expect(antes.cobrado).toBe(false);

    await call(
      setRule,
      { actionKey: ACOES.mensagemEnviada, stars: 2 },
      doAdmin(),
    );
    await creditar({
      organizationId: org.id,
      valor: 10,
      tipo: "MANUAL_ADJUST",
      descricao: "Saldo para o teste",
    });

    const depois = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem",
    });
    expect(depois.cobrado).toBe(true);
    expect(depois.valor).toBe(2);
    expect(depois.saldoDepois).toBe(8);
  });

  it("zero desliga de novo", async () => {
    await call(
      setRule,
      { actionKey: ACOES.mensagemEnviada, stars: 4 },
      doAdmin(),
    );
    const ligada = await call(
      setRule,
      { actionKey: ACOES.mensagemEnviada, stars: 0 },
      doAdmin(),
    );
    expect(ligada.cobrancaAtiva).toBe(false);

    // E o motor volta a não cobrar, sem saldo nenhum na conta.
    const resultado = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem",
    });
    expect(resultado.cobrado).toBe(false);
  });

  it("mudar o preço não cria uma segunda regra", async () => {
    await call(
      setRule,
      { actionKey: ACOES.mensagemEnviada, stars: 1 },
      doAdmin(),
    );
    await call(
      setRule,
      { actionKey: ACOES.mensagemEnviada, stars: 9 },
      doAdmin(),
    );

    const regras = await prisma.starRule.findMany({
      where: { organizationId: org.id, actionKey: ACOES.mensagemEnviada },
      select: { stars: true },
    });
    expect(regras).toHaveLength(1);
    expect(regras[0].stars).toBe(9);
  });

  it("o preço de uma ação não afeta a outra", async () => {
    await call(
      setRule,
      { actionKey: ACOES.destinatarioDeCampanha, stars: 1 },
      doAdmin(),
    );

    const lista = await call(listRules, {}, doAdmin());
    const mensagem = lista.regras.find(
      (r) => r.actionKey === ACOES.mensagemEnviada,
    );
    const campanha = lista.regras.find(
      (r) => r.actionKey === ACOES.destinatarioDeCampanha,
    );
    expect(mensagem?.stars).toBe(0);
    expect(campanha?.stars).toBe(1);
    expect(lista.cobrancaAtiva).toBe(true);
  });
});
