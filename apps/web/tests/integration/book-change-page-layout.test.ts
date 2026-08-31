import { changeBookPageLayout } from "@/app/router/book/change-page-layout";
import type {
  Organization,
  Store,
  Supplier,
  User,
} from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { call } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * Dois slots horizontais LADO A LADO — o arranjo que o gerador embutido nunca
 * produz (ele empilha as horizontais). Se o padrão salvo for usado de verdade,
 * é isto que sai.
 */
const PADRAO_SALVO_2_HORIZONTAIS = [
  {
    id: "slot-esq",
    type: "photoSlot",
    slotIndex: 0,
    x: 40,
    y: 140,
    width: 430,
    height: 260,
    rotation: 0,
    objectFit: "cover",
    cornerRadius: 0,
  },
  {
    id: "slot-dir",
    type: "photoSlot",
    slotIndex: 1,
    x: 490,
    y: 140,
    width: 430,
    height: 260,
    rotation: 0,
    objectFit: "cover",
    cornerRadius: 0,
  },
];

function slotsDe(layout: unknown) {
  return (Array.isArray(layout) ? layout : []).filter(
    (el): el is { x: number; y: number; width: number; height: number } =>
      !!el && typeof el === "object" && "type" in el && el.type === "photoSlot",
  );
}

describe("book.changePageLayout", () => {
  let org: Organization;
  let user: User;
  let store: Store;
  let supplier: Supplier;
  let pageId: string;

  beforeEach(async () => {
    await resetDb();
    org = await createOrg("Rede");
    user = await createUser();
    await createMember(user, org);

    supplier = await prisma.supplier.create({
      data: { organizationId: org.id, name: "Indústria" },
    });
    store = await prisma.store.create({
      data: { organizationId: org.id, name: "Loja" },
    });

    const book = await prisma.book.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        name: "Book",
        periodMonth: 8,
        periodYear: 2026,
        createdById: user.id,
      },
      select: { id: true },
    });
    pageId = (
      await prisma.bookPage.create({
        data: { bookId: book.id, order: 0, storeId: store.id },
        select: { id: true },
      })
    ).id;
  });

  afterEach(resetDb);

  const mudar = (orientation: "LANDSCAPE" | "PORTRAIT", size: number) =>
    call(
      changeBookPageLayout,
      { bookPageId: pageId, orientation, size },
      { context: s2sContext(user, org) },
    );

  const layoutDaPagina = async () =>
    (
      await prisma.bookPage.findUniqueOrThrow({
        where: { id: pageId },
        select: { pageLayout: true },
      })
    ).pageLayout;

  // A regressão relatada: o padrão salvo com 2 horizontais lado a lado saía
  // empilhado, porque o handler nunca consultava BookPageTemplate.
  it("usa o padrão salvo da indústria em vez do gerador embutido", async () => {
    await prisma.bookPageTemplate.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        name: "2 horizontais lado a lado",
        kind: "PHOTO",
        photoOrientation: "LANDSCAPE",
        photoSize: 2,
        layout: PADRAO_SALVO_2_HORIZONTAIS,
      },
    });

    await mudar("LANDSCAPE", 2);

    const slots = slotsDe(await layoutDaPagina());
    expect(slots).toHaveLength(2);
    // Lado a lado: mesma altura de topo, x diferente.
    expect(slots[0].y).toBe(slots[1].y);
    expect(slots[0].x).not.toBe(slots[1].x);
    expect(slots[0].width).toBe(430);
  });

  it("cai no gerador embutido quando não há padrão salvo", async () => {
    await mudar("LANDSCAPE", 2);

    const slots = slotsDe(await layoutDaPagina());
    expect(slots).toHaveLength(2);
    // Empilhado: mesmo x, y diferente. É o comportamento antigo, preservado
    // para quem não cadastrou padrão.
    expect(slots[0].x).toBe(slots[1].x);
    expect(slots[0].y).not.toBe(slots[1].y);
  });

  it("não usa padrão de outra indústria", async () => {
    const outra = await prisma.supplier.create({
      data: { organizationId: org.id, name: "Outra indústria" },
    });
    await prisma.bookPageTemplate.create({
      data: {
        organizationId: org.id,
        supplierId: outra.id,
        name: "2 horizontais lado a lado",
        kind: "PHOTO",
        photoOrientation: "LANDSCAPE",
        photoSize: 2,
        layout: PADRAO_SALVO_2_HORIZONTAIS,
      },
    });

    await mudar("LANDSCAPE", 2);

    const slots = slotsDe(await layoutDaPagina());
    expect(slots[0].x).toBe(slots[1].x); // empilhado = gerador embutido
  });

  it("não confunde o padrão de outra combinação de orientação/quantidade", async () => {
    await prisma.bookPageTemplate.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        name: "2 horizontais lado a lado",
        kind: "PHOTO",
        photoOrientation: "LANDSCAPE",
        photoSize: 2,
        layout: PADRAO_SALVO_2_HORIZONTAIS,
      },
    });

    await mudar("LANDSCAPE", 1);

    const slots = slotsDe(await layoutDaPagina());
    expect(slots).toHaveLength(1);
  });

  it("não deixa alterar página de outra organização", async () => {
    const outraOrg = await createOrg("Outra rede");
    const outroUser = await createUser();
    await createMember(outroUser, outraOrg);

    await expect(
      call(
        changeBookPageLayout,
        { bookPageId: pageId, orientation: "LANDSCAPE", size: 2 },
        { context: s2sContext(outroUser, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrada/i);
  });
});
