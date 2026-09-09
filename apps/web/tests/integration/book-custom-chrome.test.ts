import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBook } from "@/app/router/book/get";
import { resetBookChrome } from "@/app/router/book/reset-chrome";
import { updateBookCoverLayout } from "@/app/router/book/update-cover-layout";
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
 * Regressão da capa que não salvava: o padrão COVER da indústria vencia SEMPRE
 * na leitura, então editar a capa dentro do book gravava num campo que ninguém
 * lia — a tela dizia "Salvo" e o PDF saía com o título antigo.
 *
 * A regra que este teste tranca: herda até a primeira edição, depois é do book,
 * e `resetChrome` devolve a herança.
 */
function textoDoTitulo(layout: unknown): string | undefined {
  if (!Array.isArray(layout)) return undefined;
  const titulo = layout.find(
    (el): el is { type: "text"; text: string } =>
      !!el && typeof el === "object" && (el as { type?: string }).type === "text",
  );
  return titulo?.text;
}

function layoutComTitulo(text: string) {
  return [
    {
      id: "titulo",
      type: "text" as const,
      x: 80,
      y: 260,
      width: 800,
      height: 56,
      rotation: 0,
      text,
      fontSize: 53,
      color: "#ffffff",
      align: "center" as const,
      fontWeight: "bold" as const,
      uppercase: true,
    },
  ];
}

const fundo = { color: "#c1121f", opacity: 1, imageKey: null };

describe("book — capa própria vs padrão da indústria", () => {
  let org: Organization;
  let user: User;
  let bookId: string;

  beforeAll(async () => {
    await resetDb();
    org = await createOrg("Org do book");
    user = await createUser();
    await createMember(user, org);

    const supplier = await prisma.supplier.create({
      data: { organizationId: org.id, name: "Indústria de teste" },
    });
    await prisma.bookPageTemplate.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        kind: "COVER",
        name: "Capa",
        layout: layoutComTitulo("CAPA DO PADRÃO"),
        background: fundo,
      },
    });

    const book = await prisma.book.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        name: "Book de teste",
        supplierId: supplier.id,
        periodMonth: 9,
        periodYear: 2026,
        coverLayout: layoutComTitulo("SNAPSHOT ANTIGO"),
        coverBackground: fundo,
      },
    });
    bookId = book.id;
  });

  afterAll(async () => {
    await resetDb();
  });

  it("sem edição, a capa vem do padrão da indústria", async () => {
    const antes = await call(
      getBook,
      { id: bookId },
      { context: s2sContext(user, org) },
    );

    expect(antes.customChrome).toBe(false);
    expect(antes.hasIndustryChrome).toBe(true);
    expect(textoDoTitulo(antes.coverLayout)).toBe("CAPA DO PADRÃO");
  });

  it("editar a capa dentro do book passa a valer, e só para ele", async () => {
    await call(
      updateBookCoverLayout,
      {
        id: bookId,
        coverLayout: layoutComTitulo("BOOK SETEMBRO"),
        closingLayout: [],
        coverBackground: fundo,
        closingBackground: fundo,
      },
      { context: s2sContext(user, org) },
    );

    const depois = await call(
      getBook,
      { id: bookId },
      { context: s2sContext(user, org) },
    );

    expect(depois.customChrome).toBe(true);
    // O padrão continua lá — é o que permite o caminho de volta.
    expect(depois.hasIndustryChrome).toBe(true);
    expect(textoDoTitulo(depois.coverLayout)).toBe("BOOK SETEMBRO");
  });

  it("resetChrome devolve o book à herança do padrão", async () => {
    await call(
      resetBookChrome,
      { id: bookId },
      { context: s2sContext(user, org) },
    );

    const depois = await call(
      getBook,
      { id: bookId },
      { context: s2sContext(user, org) },
    );

    expect(depois.customChrome).toBe(false);
    expect(textoDoTitulo(depois.coverLayout)).toBe("CAPA DO PADRÃO");
  });

  it("book de outra org não é alcançável", async () => {
    const outraOrg = await createOrg("Org intrusa");
    const intruso = await createUser();
    await createMember(intruso, outraOrg);

    await expect(
      call(
        resetBookChrome,
        { id: bookId },
        { context: s2sContext(intruso, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});
