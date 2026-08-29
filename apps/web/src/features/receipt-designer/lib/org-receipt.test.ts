import { describe, expect, it } from "vitest";
import { toReceiptOrg } from "./org-receipt";

describe("toReceiptOrg", () => {
  it("prefere o nome fantasia à razão social", () => {
    const org = toReceiptOrg({
      name: "Comercial XPTO LTDA",
      tradeName: "Mercado do Zé",
    });

    expect(org.name).toBe("Mercado do Zé");
  });

  it("cai na razão social quando não há nome fantasia", () => {
    expect(toReceiptOrg({ name: "Comercial XPTO LTDA" }).name).toBe(
      "Comercial XPTO LTDA",
    );
    expect(
      toReceiptOrg({ name: "Comercial XPTO LTDA", tradeName: "" }).name,
    ).toBe("Comercial XPTO LTDA");
  });

  it("junta logradouro e número num endereço só", () => {
    expect(
      toReceiptOrg({ address: "Rua das Flores", addressNumber: "220" }).address,
    ).toBe("Rua das Flores, 220");
  });

  it("omite o endereço quando não há nem logradouro nem número", () => {
    expect(toReceiptOrg({}).address).toBeNull();
    expect(toReceiptOrg({ addressNumber: "220" }).address).toBe("220");
  });

  // A logo é key do R2 (Configurações) ou base64 (criação da org): as duas
  // precisam virar src renderizável, senão o cupom sai sem a marca.
  it("passa a logo pelo constructUrl preservando base64", () => {
    const base64 = "data:image/png;base64,iVBORw0KGgo=";

    expect(toReceiptOrg({ logo: base64 }).logoUrl).toBe(base64);
    expect(toReceiptOrg({ logo: "https://cdn.exemplo/x.png" }).logoUrl).toBe(
      "https://cdn.exemplo/x.png",
    );
    expect(toReceiptOrg({ logo: "/marcas/pepsi.svg" }).logoUrl).toBe(
      "/marcas/pepsi.svg",
    );
  });

  it("não inventa logo quando a org não tem", () => {
    expect(toReceiptOrg({ logo: null }).logoUrl).toBeNull();
    expect(toReceiptOrg({}).logoUrl).toBeNull();
  });
});
