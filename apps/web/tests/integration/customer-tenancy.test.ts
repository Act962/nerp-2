import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteCustomer } from "@/app/router/customer/delete";
import { getCustomer } from "@/app/router/customer/get";
import { updateCustomer } from "@/app/router/customer/update";
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
 * Isolamento do cadastro de clientes entre organizações.
 *
 * Regressão de três vazamentos reais que existiam em `customer.get`,
 * `customer.update` e `customer.delete`: os três buscavam por `findUnique({ id })`
 * sem confrontar a organização, e o `update` nem tinha o middleware de
 * organização. Qualquer usuário autenticado lia o cadastro **e o histórico de
 * compras**, editava ou apagava o cliente de qualquer outra loja sabendo um
 * id — que sai em URL, em exportação e em log.
 *
 * O molde é o de `supplier-list.test.ts`, que já existia justamente por um
 * bug igual em fornecedores.
 */

let org: Organization;
let outraOrg: Organization;
let dono: User;
let vizinho: User;
let customerId: string;

const ctx = () => ({ context: s2sContext(dono, org) });
const doVizinho = () => ({ context: s2sContext(vizinho, outraOrg) });

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja dona do cadastro");
  outraOrg = await createOrg("Loja vizinha");
  dono = await createUser();
  vizinho = await createUser();
  await createMember(dono, org);
  await createMember(vizinho, outraOrg);
});

beforeEach(async () => {
  await prisma.customer.deleteMany({
    where: { organizationId: { in: [org.id, outraOrg.id] } },
  });
  customerId = (
    await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: "Mercearia da Esquina",
        phone: "(85) 99111-2222",
        email: "contato@mercearia.local",
      },
      select: { id: true },
    })
  ).id;
});

afterAll(resetDb);

describe("customer.get", () => {
  it("devolve o cliente para a própria organização", async () => {
    const resultado = await call(getCustomer, { id: customerId }, ctx());
    expect(resultado.customer.name).toBe("Mercearia da Esquina");
  });

  it("não devolve o cliente — nem as compras dele — para a vizinha", async () => {
    await expect(
      call(getCustomer, { id: customerId }, doVizinho()),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("customer.update", () => {
  it("edita o da própria organização", async () => {
    const resultado = await call(
      updateCustomer,
      { id: customerId, name: "Mercearia Central" },
      ctx(),
    );
    expect(resultado.customer.name).toBe("Mercearia Central");
  });

  it("a vizinha não edita, e o cadastro fica intacto", async () => {
    await expect(
      call(
        updateCustomer,
        { id: customerId, name: "Sequestrado" },
        doVizinho(),
      ),
    ).rejects.toThrow(/não encontrado/i);

    const depois = await prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { name: true },
    });
    expect(depois.name).toBe("Mercearia da Esquina");
  });

  it("não vincula tabela de preço de outra organização", async () => {
    const tabelaDeFora = await prisma.priceList.create({
      data: {
        organizationId: outraOrg.id,
        name: "Atacado da vizinha",
        slug: "atacado-vizinha",
      },
      select: { id: true },
    });

    await expect(
      call(
        updateCustomer,
        { id: customerId, priceListId: tabelaDeFora.id },
        ctx(),
      ),
    ).rejects.toThrow(/tabela de preço não encontrada/i);

    const depois = await prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { priceListId: true },
    });
    expect(depois.priceListId).toBeNull();
  });
});

describe("customer.delete", () => {
  it("a vizinha não apaga, e o cliente continua lá", async () => {
    await expect(
      call(deleteCustomer, { id: customerId }, doVizinho()),
    ).rejects.toThrow(/não encontrado/i);

    const aindaExiste = await prisma.customer.count({
      where: { id: customerId },
    });
    expect(aindaExiste).toBe(1);
  });

  it("a própria organização apaga", async () => {
    await call(deleteCustomer, { id: customerId }, ctx());
    const sobrou = await prisma.customer.count({ where: { id: customerId } });
    expect(sobrou).toBe(0);
  });
});
