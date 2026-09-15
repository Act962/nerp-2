import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { enviar } from "@/app/router/melhorias/enviar";
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
 * As melhorias pedidas de dentro do ERP.
 *
 * Duas coisas em teste: o print só entra se for do bucket de QUEM enviou (uma
 * requisição forjada não pendura imagem alheia no chamado), e a linha guarda
 * um retrato da empresa — ela precisa sobreviver à empresa, porque sandbox
 * expira em 30 dias e o pedido continua valendo.
 */

const HOST = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;

describe("melhorias.enviar", () => {
  let orgA: Organization;
  let orgB: Organization;
  let ana: User;

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    ana = await createUser();
    await createMember(ana, orgA);
  });

  beforeEach(async () => {
    await prisma.siteMelhoria.deleteMany({});
  });

  afterAll(async () => {
    await prisma.siteMelhoria.deleteMany({});
    await resetDb();
  });

  it("grava o pedido com a tela e o retrato de quem pediu", async () => {
    const { id } = await call(
      enviar,
      {
        pathname: "/vendas/novo",
        mensagem: "Queria buscar produto pelo nome do fornecedor também",
        imagens: [],
      },
      { context: s2sContext(ana, orgA) },
    );

    const gravada = await prisma.siteMelhoria.findUniqueOrThrow({
      where: { id },
    });
    expect(gravada.pathname).toBe("/vendas/novo");
    expect(gravada.status).toBe("NOVA");
    expect(gravada.organizationId).toBe(orgA.id);
    // Retrato, não junção: a empresa pode deixar de existir.
    expect(gravada.organizationName).toBe(orgA.name);
    expect(gravada.userName).toBe(ana.name);
    expect(gravada.userEmail).toBe(ana.email);
  });

  it("mensagem curta demais é recusada antes de chegar ao banco", async () => {
    await expect(
      call(
        enviar,
        { pathname: "/dashboard", mensagem: "ruim", imagens: [] },
        { context: s2sContext(ana, orgA) },
      ),
    ).rejects.toThrow();

    expect(await prisma.siteMelhoria.count()).toBe(0);
  });

  it.skipIf(!HOST)("print do bucket da vizinha é recusado", async () => {
    await expect(
      call(
        enviar,
        {
          pathname: "/dashboard",
          mensagem: "Olha esta tela aqui, está estranha",
          imagens: [`https://${HOST}/${orgB.id}/melhorias/roubada.png`],
        },
        { context: s2sContext(ana, orgA) },
      ),
    ).rejects.toThrow(/fora do endereço desta empresa/);

    expect(await prisma.siteMelhoria.count()).toBe(0);
  });

  it.skipIf(!HOST)("print da própria empresa entra", async () => {
    const url = `https://${HOST}/${orgA.id}/melhorias/tela.png`;
    const { id } = await call(
      enviar,
      {
        pathname: "/dashboard",
        mensagem: "O botão de finalizar some no celular",
        imagens: [url],
      },
      { context: s2sContext(ana, orgA) },
    );

    const gravada = await prisma.siteMelhoria.findUniqueOrThrow({
      where: { id },
    });
    expect(gravada.imagens).toEqual([url]);
  });
});
