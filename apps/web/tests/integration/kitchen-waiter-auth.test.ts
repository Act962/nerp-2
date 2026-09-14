import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { waiterCollaborators } from "@/app/router/pedidos/waiter-collaborators";
import { waiterCreate } from "@/app/router/pedidos/waiter-create";
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
 * O app do garçom deixou de ser público.
 *
 * Estas procedures aceitavam `orgSlug` + `attendantId` como única credencial, e
 * o `attendantId` saía publicamente de `waiterCollaborators` a partir do mesmo
 * slug: quem soubesse o endereço da loja criava e "entregava" pedido. A página
 * já exigia login — o buraco era só nas procedures.
 *
 * O que este teste protege é a regra que o `requireOrgMiddleware` NÃO dá aqui:
 * a organização vem do slug da URL, não da organização ativa da sessão, então a
 * checagem de vínculo tem que ser feita contra o slug. Sem ela, um membro de
 * qualquer organização agiria na cozinha de qualquer outra.
 */
describe("procedures do garçom", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let colaboradorA: { id: string };

  beforeAll(async () => {
    await resetDb();

    orgA = await createOrg("Lanches A");
    orgB = await createOrg("Lanches B");
    userA = await createUser();
    await createMember(userA, orgA);

    colaboradorA = await prisma.collaborator.create({
      data: { organizationId: orgA.id, name: "Zé", role: "Garçom" },
      select: { id: true },
    });

    await prisma.kitchenColumn.create({
      data: {
        organizationId: orgA.id,
        name: "Em preparo",
        position: 0,
        isInitial: true,
      },
    });
  });

  afterAll(resetDb);

  it("recusa quem não tem sessão", async () => {
    await expect(
      call(
        waiterCollaborators,
        { orgSlug: orgA.slug ?? "" },
        { context: { headers: new Headers() } },
      ),
    ).rejects.toThrow();
  });

  it("recusa membro da org A agindo na org B", async () => {
    await expect(
      call(
        waiterCollaborators,
        { orgSlug: orgB.slug ?? "" },
        { context: s2sContext(userA, orgA) },
      ),
    ).rejects.toThrow();
  });

  it("deixa o membro listar os colaboradores da própria org", async () => {
    const colaboradores = await call(
      waiterCollaborators,
      { orgSlug: orgA.slug ?? "" },
      { context: s2sContext(userA, orgA) },
    );

    expect(colaboradores.map((c) => c.name)).toEqual(["Zé"]);
  });

  it("cria o pedido do balcão já aceito e sob um único ticket", async () => {
    const resultado = await call(
      waiterCreate,
      {
        orgSlug: orgA.slug ?? "",
        attendantId: colaboradorA.id,
        tableNumber: "Balcão 1",
        items: [
          { dishName: "X-Salada", quantity: 1 },
          { dishName: "Refrigerante", quantity: 2 },
        ],
      },
      { context: s2sContext(userA, orgA) },
    );

    expect(resultado.count).toBe(2);
    expect(resultado.ticketId).toBeTruthy();

    const pedidos = await prisma.kitchenOrder.findMany({
      where: { organizationId: orgA.id },
      select: { ticketId: true, acceptedAt: true },
    });

    expect(pedidos).toHaveLength(2);
    // Um pedido só: os dois itens compartilham o ticket.
    expect(new Set(pedidos.map((p) => p.ticketId)).size).toBe(1);
    // Quem monta no balcão está com o cliente na frente: entra direto na
    // cozinha, sem passar pela fila de aceite.
    expect(pedidos.every((p) => p.acceptedAt !== null)).toBe(true);
  });

  it("não deixa criar pedido na cozinha de outra organização", async () => {
    await expect(
      call(
        waiterCreate,
        {
          orgSlug: orgB.slug ?? "",
          attendantId: colaboradorA.id,
          tableNumber: "1",
          items: [{ dishName: "X-Salada", quantity: 1 }],
        },
        { context: s2sContext(userA, orgA) },
      ),
    ).rejects.toThrow();
  });
});
