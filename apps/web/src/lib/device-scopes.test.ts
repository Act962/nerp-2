import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEVICE_SCOPES,
  deviceCanAccess,
  requiredDeviceScope,
} from "./device-scopes";

describe("escopos de dispositivo", () => {
  it("libera as procedures do contrato do desktop para um terminal padrão", () => {
    const desktop = [
      ["products", "pull"],
      ["products", "list"],
      ["sales", "createFromDevice"],
      ["caixa", "openFromDevice"],
      ["caixa", "movementFromDevice"],
      ["caixa", "closeFromDevice"],
    ];
    for (const path of desktop) {
      expect(deviceCanAccess(path, DEFAULT_DEVICE_SCOPES)).toBe(true);
    }
  });

  it("é fail-closed: procedure fora do mapa é negada mesmo com todo escopo", () => {
    const foraDoContrato = [
      ["supplier", "list"], // procedure comum do ERP
      ["sales", "create"], // venda ONLINE, que revalida preço
      ["device", "pair"], // emitir outro token
      ["device", "revoke"],
      ["organization", "update"],
    ];
    for (const path of foraDoContrato) {
      expect(requiredDeviceScope(path)).toBeNull();
      expect(deviceCanAccess(path, DEFAULT_DEVICE_SCOPES)).toBe(false);
    }
  });

  it("nega quando o device não tem o escopo daquela procedure", () => {
    const soConsulta = ["pdv:sync"];
    expect(deviceCanAccess(["products", "pull"], soConsulta)).toBe(true);
    expect(deviceCanAccess(["sales", "createFromDevice"], soConsulta)).toBe(
      false,
    );
    expect(deviceCanAccess(["caixa", "openFromDevice"], soConsulta)).toBe(
      false,
    );
  });

  it("path que colide com Object.prototype não vira escopo", () => {
    // Num objeto literal, `SCOPE_BY_PATH["constructor"]` devolveria a função
    // `Object` — não-nula, e portanto um "escopo exigido" inventado.
    for (const path of [
      ["constructor"],
      ["toString"],
      ["valueOf"],
      ["__proto__"],
      ["hasOwnProperty"],
    ]) {
      expect(requiredDeviceScope(path)).toBeNull();
      expect(deviceCanAccess(path, DEFAULT_DEVICE_SCOPES)).toBe(false);
    }
  });

  it("device sem escopo nenhum não chama nada", () => {
    expect(deviceCanAccess(["products", "pull"], [])).toBe(false);
  });

  it("path vazio (call() sem path) não vira acesso liberado", () => {
    expect(deviceCanAccess([], DEFAULT_DEVICE_SCOPES)).toBe(false);
  });
});
