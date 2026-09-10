import { describe, expect, it } from "vitest";
import { escopoS2SExigido, s2sPodeAcessar } from "./s2s-scopes";

describe("s2sPodeAcessar", () => {
  it("libera só o path listado, e só com o escopo dele", () => {
    expect(s2sPodeAcessar(["mapObject", "listSpaces"], ["pdv:read"])).toBe(
      true,
    );
    expect(s2sPodeAcessar(["mapObject", "listSpaces"], ["outro"])).toBe(false);
    expect(s2sPodeAcessar(["mapObject", "listSpaces"], [])).toBe(false);
  });

  it("fail-closed: procedure fora do mapa nunca passa, com qualquer escopo", () => {
    expect(s2sPodeAcessar(["invitation", "create"], ["pdv:read"])).toBe(false);
    expect(s2sPodeAcessar(["stars", "checkout"], ["pdv:read"])).toBe(false);
    expect(escopoS2SExigido(["constructor"])).toBeNull();
  });

  it("o escopo total abre tudo", () => {
    expect(s2sPodeAcessar(["invitation", "create"], ["*"])).toBe(true);
  });
});
