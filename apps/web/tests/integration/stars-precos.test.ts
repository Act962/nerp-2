import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listRules } from "@/app/router/stars/list-rules";
import { starsRoutes } from "@/app/router/stars";
import { gravarRegra } from "@/features/stars/server/regras";
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
 * Preço das ações — o que liga a cobrança.
 *
 * **Quem escreve mudou de lado.** A tela de preço saiu de dentro da
 * organização e foi para `/site/stars`, no painel da plataforma: com o campo na
 * mão do cliente, uma conta zerou o próprio preço e usou o Astro de graça por
 * dias sem nada aparecer. A organização agora só LÊ.
 *
 * Por isso os testes de escrita chamam `gravarRegra` direto, e não uma
 * procedure: a porta de escrita é guardada por `requireSiteAdminMiddleware`,
 * que resolve a sessão pelos headers e não tem ramo S2S — o contexto desta
 * suíte não a alcança. O que se prende aqui é a REGRA; a guarda do site é
 * exercida pela tela.
 */

let org: Organization;
let outraOrg: Organization;
let admin: User;
let vizinho: User;

const doAdmin = () => ({ context: s2sContext(admin, org) });
const doVizinho = () => ({ context: s2sContext(vizinho, outraOrg) });

/** O que a plataforma faz por trás da tela de `/site/stars`. */
const definirPreco = (actionKey: string, stars: number, alvo = org) =>
  gravarRegra({ organizationId: alvo.id, actionKey, stars });

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja que cobra");
  outraOrg = await createOrg("Loja vizinha");
  admin = await createUser();
  vizinho = await createUser();

  await createMember(admin, org);
  await createMember(vizinho, outraOrg);
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

  it("a organização não tem porta para ESCREVER o preço", async () => {
    // A checagem que importa depois da mudança: nenhuma procedure de
    // organização grava preço. Se alguém reintroduzir uma, este teste cai.
    expect(Object.keys(starsRoutes.rules)).toEqual(["list"]);
  });

  it("a organização vizinha não enxerga os preços desta", async () => {
    await definirPreco(ACOES.mensagemEnviada, 7);

    const dela = await call(listRules, {}, doVizinho());
    expect(dela.regras.every((r) => r.stars === 0)).toBe(true);
    expect(dela.cobrancaAtiva).toBe(false);
  });
});

describe("definição do preço", () => {
  it("recusa ação que não existe no catálogo", async () => {
    // Sem esta conferência dava para gravar preço para uma ação que ninguém
    // cobra — uma linha órfã que só aparece confundindo quem for auditar.
    await expect(definirPreco("acao_inventada", 5)).rejects.toThrow(
      /desconhecida/i,
    );
    expect(
      await prisma.starRule.count({ where: { organizationId: org.id } }),
    ).toBe(0);
  });

  it("ligar a cobrança faz o motor passar a debitar", async () => {
    // Antes: sem preço, nada é cobrado nem bloqueado.
    const antes = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem",
    });
    expect(antes.cobrado).toBe(false);

    await definirPreco(ACOES.mensagemEnviada, 2);
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
    await definirPreco(ACOES.mensagemEnviada, 4);
    const desligada = await definirPreco(ACOES.mensagemEnviada, 0);
    expect(desligada.cobrancaAtiva).toBe(false);

    // E o motor volta a não cobrar, sem saldo nenhum na conta.
    const resultado = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem",
    });
    expect(resultado.cobrado).toBe(false);
  });

  it("mudar o preço não cria uma segunda regra", async () => {
    await definirPreco(ACOES.mensagemEnviada, 1);
    await definirPreco(ACOES.mensagemEnviada, 9);

    const regras = await prisma.starRule.findMany({
      where: { organizationId: org.id, actionKey: ACOES.mensagemEnviada },
      select: { stars: true },
    });
    expect(regras).toHaveLength(1);
    expect(regras[0].stars).toBe(9);
  });

  it("o preço de uma ação não afeta a outra", async () => {
    await definirPreco(ACOES.destinatarioDeCampanha, 1);

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
