import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CotaDeUploadExcedidaError,
  reservarCotaDeUpload,
} from "@/features/uploads/server/cota";
import { chavePertenceAOrg } from "@/features/uploads/server/posse";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createMember, createOrg, createUser, resetDb } from "./helpers";

let orgA: Organization;
let orgB: Organization;
let dono: User;

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org que sobe arquivo");
  orgB = await createOrg("Outra org");
  dono = await createUser();
  await createMember(dono, orgA);
});

afterAll(resetDb);

describe("reservarCotaDeUpload", () => {
  it("soma por dia e por organização e estoura no limite", async () => {
    const agora = new Date("2026-09-11T15:00:00Z");
    const limite = 1000;
    await reservarCotaDeUpload({
      organizationId: orgA.id,
      bytes: 600,
      limiteBytes: limite,
      agora,
    });
    const segunda = await reservarCotaDeUpload({
      organizationId: orgA.id,
      bytes: 400,
      limiteBytes: limite,
      agora,
    });
    expect(segunda.usadoBytes).toBe(1000);

    await expect(
      reservarCotaDeUpload({
        organizationId: orgA.id,
        bytes: 1,
        limiteBytes: limite,
        agora,
      }),
    ).rejects.toBeInstanceOf(CotaDeUploadExcedidaError);

    // A outra organização e o dia seguinte começam do zero.
    const outra = await reservarCotaDeUpload({
      organizationId: orgB.id,
      bytes: 900,
      limiteBytes: limite,
      agora,
    });
    expect(outra.usadoBytes).toBe(900);
    const amanha = await reservarCotaDeUpload({
      organizationId: orgA.id,
      bytes: 500,
      limiteBytes: limite,
      agora: new Date("2026-09-12T15:00:00Z"),
    });
    expect(amanha.usadoBytes).toBe(500);
  });

  it("duas reservas simultâneas no fim da cota não passam as duas", async () => {
    const agora = new Date("2026-10-01T15:00:00Z");
    const resultados = await Promise.allSettled([
      reservarCotaDeUpload({
        organizationId: orgA.id,
        bytes: 700,
        limiteBytes: 1000,
        agora,
      }),
      reservarCotaDeUpload({
        organizationId: orgA.id,
        bytes: 700,
        limiteBytes: 1000,
        agora,
      }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

describe("chavePertenceAOrg", () => {
  it("prefixo decide para chaves novas", async () => {
    expect(await chavePertenceAOrg(orgA.id, `${orgA.id}/abc-foto.png`)).toBe(
      true,
    );
    expect(await chavePertenceAOrg(orgA.id, `${orgB.id}/abc-foto.png`)).toBe(
      false,
    );
  });

  it("chave antiga sem prefixo só é da org que a referencia", async () => {
    await prisma.product.create({
      data: {
        organizationId: orgA.id,
        createdById: dono.id,
        name: "Com foto",
        slug: "com-foto",
        salePrice: 1,
        thumbnail: "legado-thumb.png",
        images: ["legado-1.png"],
      },
    });
    expect(await chavePertenceAOrg(orgA.id, "legado-thumb.png")).toBe(true);
    expect(await chavePertenceAOrg(orgA.id, "legado-1.png")).toBe(true);
    expect(await chavePertenceAOrg(orgB.id, "legado-thumb.png")).toBe(false);
    expect(await chavePertenceAOrg(orgA.id, "de-ninguem.png")).toBe(false);
  });
});
