import { describe, expect, it } from "vitest";
import { whatsappHref } from "./origin-config";

describe("whatsappHref", () => {
  it("acrescenta o DDI do Brasil quando falta", () => {
    expect(whatsappHref("(86) 99999-1234")).toBe("https://wa.me/5586999991234");
  });

  it("mantém o DDI quando já vem no número", () => {
    expect(whatsappHref("+55 86 99999-1234")).toBe(
      "https://wa.me/5586999991234",
    );
  });

  it("não gera link para telefone incompleto ou ausente", () => {
    expect(whatsappHref("9999")).toBeNull();
    expect(whatsappHref(null)).toBeNull();
  });
});
