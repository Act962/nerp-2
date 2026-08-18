import * as prismaEnums from "@/generated/prisma/enums";
import * as shared from "@nerp/types";
import { describe, expect, it } from "vitest";

// Guarda anti-drift: os enums espelhados à mão em `@nerp/types` (que o device
// usa offline, sem puxar o client do Prisma) têm que bater com os do schema.
// Este teste quebra o dia em que um enum do Prisma mudar sem atualizar o espelho.
const sorted = (e: Record<string, string>) => Object.values(e).sort();

describe("paridade de enums @nerp/types × Prisma", () => {
  it("SaleStatus", () => {
    expect(sorted(shared.SaleStatus)).toEqual(sorted(prismaEnums.SaleStatus));
  });
  it("PaymentMethod", () => {
    expect(sorted(shared.PaymentMethod)).toEqual(
      sorted(prismaEnums.PaymentMethod),
    );
  });
  it("PersonType", () => {
    expect(sorted(shared.PersonType)).toEqual(sorted(prismaEnums.PersonType));
  });
  it("MovementType", () => {
    expect(sorted(shared.MovementType)).toEqual(
      sorted(prismaEnums.MovementType),
    );
  });
});
