import { describe, expect, it } from "vitest";
import { makeTestPfx } from "./__fixtures__/make-test-pfx";
import {
  CertificateError,
  isExpired,
  matchesCnpj,
  parsePfx,
} from "./certificate";

// Gerar RSA custa ~100ms por chamada; os casos que compartilham o mesmo
// certificado reusam este.
const padrao = makeTestPfx();

describe("parsePfx", () => {
  it("lê titular, emissor e validade", () => {
    const cert = parsePfx(padrao.pfx, padrao.password);

    expect(cert.subjectName).toBe("LOJA TESTE LTDA:12345678000195");
    expect(cert.issuerName).toBe("AC TESTE v1");
    expect(cert.notBefore.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(cert.notAfter.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("extrai o CNPJ do subjectAltName (OID 2.16.76.1.3.3)", () => {
    expect(parsePfx(padrao.pfx, padrao.password).cnpj).toBe("12345678000195");
  });

  it("cai no CN quando o certificado não traz o subjectAltName", () => {
    // Sem a extensão, o CN "RAZAO:CNPJ" é a única fonte — é como vários A1
    // antigos vêm.
    const semAltName = makeTestPfx({
      cnpj: "98765432000110",
      withAltName: false,
    });
    const cert = parsePfx(semAltName.pfx, semAltName.password);
    expect(cert.cnpj).toBe("98765432000110");
  });

  it("devolve cnpj nulo em certificado sem CNPJ (e-CPF)", () => {
    const ecpf = makeTestPfx({ cnpj: null, razaoSocial: "FULANO DE TAL" });
    expect(parsePfx(ecpf.pfx, ecpf.password).cnpj).toBeNull();
  });

  it("senha errada é WRONG_PASSWORD, não erro genérico", () => {
    // O painel precisa distinguir para dizer "senha incorreta" em vez de
    // "arquivo inválido" — são ações diferentes para o usuário.
    try {
      parsePfx(padrao.pfx, "senha-errada");
      expect.unreachable("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(CertificateError);
      expect((error as CertificateError).code).toBe("WRONG_PASSWORD");
    }
  });

  it("arquivo que não é PKCS#12 é INVALID_FILE", () => {
    try {
      parsePfx(Buffer.from("isto nao e um certificado"), "x");
      expect.unreachable("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(CertificateError);
      expect((error as CertificateError).code).toBe("INVALID_FILE");
    }
  });
});

describe("isExpired", () => {
  const cert = parsePfx(padrao.pfx, padrao.password);

  it("falso antes do vencimento", () => {
    expect(isExpired(cert, new Date("2026-08-28T00:00:00Z"))).toBe(false);
  });

  it("verdadeiro depois do vencimento", () => {
    expect(isExpired(cert, new Date("2027-06-01T00:00:00Z"))).toBe(true);
  });

  it("verdadeiro no instante exato do vencimento", () => {
    expect(isExpired(cert, new Date("2027-01-01T00:00:00Z"))).toBe(true);
  });
});

describe("matchesCnpj", () => {
  const cert = parsePfx(padrao.pfx, padrao.password);

  it("aceita o CNPJ formatado da configuração", () => {
    expect(matchesCnpj(cert, "12.345.678/0001-95")).toBe(true);
  });

  it("aceita o CNPJ sem formatação", () => {
    expect(matchesCnpj(cert, "12345678000195")).toBe(true);
  });

  it("recusa certificado de outra empresa", () => {
    expect(matchesCnpj(cert, "98.765.432/0001-10")).toBe(false);
  });

  it("recusa quando a org ainda não cadastrou o CNPJ", () => {
    expect(matchesCnpj(cert, null)).toBe(false);
    expect(matchesCnpj(cert, "")).toBe(false);
  });

  it("recusa e-CPF mesmo com CNPJ cadastrado", () => {
    const ecpf = parsePfx(makeTestPfx({ cnpj: null }).pfx, "senha-de-teste");
    expect(matchesCnpj(ecpf, "12345678000195")).toBe(false);
  });
});
