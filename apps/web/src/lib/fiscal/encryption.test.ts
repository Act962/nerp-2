import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A chave-mestra é resolvida uma vez e fica em cache no módulo, então cada
 * caso importa o módulo de novo depois de ajustar a env.
 */
async function loadWithKey(key: string | undefined) {
  vi.resetModules();
  if (key === undefined) delete process.env.FISCAL_ENCRYPTION_KEY;
  else process.env.FISCAL_ENCRYPTION_KEY = key;
  return import("./encryption");
}

const CHAVE_BASE64 = Buffer.alloc(32, 7).toString("base64");
const original = process.env.FISCAL_ENCRYPTION_KEY;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (original === undefined) delete process.env.FISCAL_ENCRYPTION_KEY;
  else process.env.FISCAL_ENCRYPTION_KEY = original;
});

describe("encryptString / decryptString", () => {
  it("faz round-trip do segredo", async () => {
    const { encryptString, decryptString } = await loadWithKey(CHAVE_BASE64);
    const senha = "senha-do-certificado-A1";
    expect(decryptString(encryptString(senha))).toBe(senha);
  });

  it("cifra o mesmo texto em saídas diferentes (IV aleatório)", async () => {
    // Sem isso, dois clientes com a mesma senha teriam o mesmo ciphertext no
    // banco — vazamento por comparação.
    const { encryptString } = await loadWithKey(CHAVE_BASE64);
    expect(encryptString("igual")).not.toBe(encryptString("igual"));
  });

  it("aceita frase-senha longa derivando a chave por scrypt", async () => {
    const { encryptString, decryptString } = await loadWithKey(
      "uma-frase-secreta-suficientemente-longa",
    );
    expect(decryptString(encryptString("token"))).toBe("token");
  });

  it("preserva acentos e unicode", async () => {
    const { encryptString, decryptString } = await loadWithKey(CHAVE_BASE64);
    const valor = "çãõ-ü-日本-🔐";
    expect(decryptString(encryptString(valor))).toBe(valor);
  });

  it("string vazia entra e sai vazia, sem cifrar", async () => {
    const { encryptString, decryptString } = await loadWithKey(CHAVE_BASE64);
    expect(encryptString("")).toBe("");
    expect(decryptString("")).toBe("");
    expect(decryptString(null)).toBe("");
    expect(decryptString(undefined)).toBe("");
  });

  it("falha sem FISCAL_ENCRYPTION_KEY em vez de cifrar fraco", async () => {
    const { encryptString } = await loadWithKey(undefined);
    expect(() => encryptString("x")).toThrow(/FISCAL_ENCRYPTION_KEY/);
  });

  it("recusa formato que não tem as três partes", async () => {
    const { decryptString } = await loadWithKey(CHAVE_BASE64);
    expect(() => decryptString("soh-uma-parte")).toThrow(
      /Formato criptografado inválido/,
    );
  });

  it("recusa ciphertext adulterado (tag GCM não confere)", async () => {
    // É o ponto do GCM: alterar o payload no banco tem que estourar, não
    // devolver lixo silenciosamente.
    const { encryptString, decryptString } = await loadWithKey(CHAVE_BASE64);
    const [iv, tag, ct] = encryptString("senha").split(":");
    const adulterado = `${iv}:${tag}:${ct.slice(0, -2)}AA`;
    expect(() => decryptString(adulterado)).toThrow();
  });

  it("recusa segredo cifrado com outra chave-mestra", async () => {
    // Cenário real: a env foi rotacionada sem migrar os segredos.
    const antiga = await loadWithKey(CHAVE_BASE64);
    const cifrado = antiga.encryptString("senha");
    const nova = await loadWithKey(Buffer.alloc(32, 9).toString("base64"));
    expect(() => nova.decryptString(cifrado)).toThrow();
  });
});

describe("maskSecret", () => {
  it("mostra só os quatro últimos caracteres", async () => {
    const { maskSecret } = await loadWithKey(CHAVE_BASE64);
    expect(maskSecret("token-super-secreto-1234")).toBe("•••• 1234");
  });

  it("vazio ou nulo vira string vazia", async () => {
    const { maskSecret } = await loadWithKey(CHAVE_BASE64);
    expect(maskSecret("")).toBe("");
    expect(maskSecret(null)).toBe("");
    expect(maskSecret(undefined)).toBe("");
  });
});
