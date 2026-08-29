import { type InferRouterInputs, call } from "@orpc/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, resetDb, s2sContext } from "./helpers";

/**
 * O storage é a única dependência externa dessas procedures. Mockamos só a
 * escrita/remoção — `certificateObjectKey` e `FISCAL_KEY_PREFIX` continuam
 * reais, porque o formato da key é justamente o que separa o bucket privado
 * do público e precisa ser verificado.
 */
const storage = vi.hoisted(() => ({
  put: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
}));

vi.mock("@/lib/fiscal/storage", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/fiscal/storage")>();
  return {
    ...original,
    putFiscalObject: storage.put,
    deleteFiscalObject: storage.del,
  };
});

const { fiscalConfigRoutes } = await import("@/app/router/fiscal-config");
const { makeTestPfx } = await import("@/lib/fiscal/__fixtures__/make-test-pfx");
const { decryptString } = await import("@/lib/fiscal/encryption");

type UpsertInput = InferRouterInputs<typeof fiscalConfigRoutes>["upsert"];

const CNPJ_A = "12345678000195";
const CNPJ_B = "98765432000110";
const certA = makeTestPfx({ cnpj: CNPJ_A, razaoSocial: "REDE A LTDA" });

describe("fiscalConfig", () => {
  let orgA: Organization;
  let orgB: Organization;
  let ownerA: User;
  let caixaA: User;
  let ownerB: User;

  beforeAll(async () => {
    await resetDb();

    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    ownerA = await createUser();
    caixaA = await createUser();
    ownerB = await createUser();

    await prisma.member.createMany({
      data: [
        { organizationId: orgA.id, userId: ownerA.id, role: "owner" },
        // Papel comum: é quem NÃO pode chegar perto do certificado.
        { organizationId: orgA.id, userId: caixaA.id, role: "member" },
        { organizationId: orgB.id, userId: ownerB.id, role: "owner" },
      ],
    });
  });

  beforeEach(async () => {
    storage.put.mockClear();
    storage.del.mockClear();
    await prisma.fiscalConfig.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.fiscalConfig.createMany({
      data: [
        { organizationId: orgA.id, cnpj: CNPJ_A, legalName: "REDE A LTDA" },
        { organizationId: orgB.id, cnpj: CNPJ_B, legalName: "REDE B LTDA" },
      ],
    });
  });

  afterAll(resetDb);

  describe("get", () => {
    it("nunca devolve a key do certificado ao client", async () => {
      // A regressão que este teste tranca: com a key em mãos, qualquer um
      // baixava o .pfx por `/api/s3/image`, que não tem sessão.
      await prisma.fiscalConfig.update({
        where: { organizationId: orgA.id },
        data: { certificateKey: `fiscal/${orgA.id}/certificates/x.pfx` },
      });

      const result = await call(
        fiscalConfigRoutes.get,
        {},
        { context: s2sContext(ownerA, orgA) },
      );

      expect(result).not.toHaveProperty("certificateKey");
      expect(result.hasCertificate).toBe(true);
    });

    it("não devolve nem máscara da senha do certificado", async () => {
      // Máscara mostra os 4 últimos caracteres — em token de provedor ajuda a
      // conferir qual credencial está gravada; em senha, só encurta a busca.
      await call(
        fiscalConfigRoutes.uploadCertificate,
        {
          filename: "certificado.pfx",
          contentBase64: certA.pfx.toString("base64"),
          password: certA.password,
        },
        { context: s2sContext(ownerA, orgA) },
      );

      const result = await call(
        fiscalConfigRoutes.get,
        {},
        { context: s2sContext(ownerA, orgA) },
      );

      expect(result).not.toHaveProperty("certificatePasswordMask");
      expect(result.hasCertificatePassword).toBe(true);
    });

    it("marca como legado o certificado que ficou no bucket público antigo", async () => {
      await prisma.fiscalConfig.update({
        where: { organizationId: orgA.id },
        data: { certificateKey: "3f1a-certificado.pfx" },
      });

      const result = await call(
        fiscalConfigRoutes.get,
        {},
        { context: s2sContext(ownerA, orgA) },
      );

      expect(result.certificateStorageLegacy).toBe(true);
    });

    it("recusa leitura por membro comum", async () => {
      await expect(
        call(fiscalConfigRoutes.get, {}, { context: s2sContext(caixaA, orgA) }),
      ).rejects.toThrow(/owner\/admin/i);
    });

    it("cada org enxerga só a própria configuração", async () => {
      const a = await call(
        fiscalConfigRoutes.get,
        {},
        { context: s2sContext(ownerA, orgA) },
      );
      const b = await call(
        fiscalConfigRoutes.get,
        {},
        { context: s2sContext(ownerB, orgB) },
      );

      expect(a.cnpj).toBe(CNPJ_A);
      expect(b.cnpj).toBe(CNPJ_B);
    });
  });

  describe("upsert", () => {
    it("recusa escrita por membro comum", async () => {
      await expect(
        call(
          fiscalConfigRoutes.upsert,
          { legalName: "invasor" },
          { context: s2sContext(caixaA, orgA) },
        ),
      ).rejects.toThrow(/owner\/admin/i);
    });

    it("ignora campos de certificado enviados por fora", async () => {
      // O upsert não é mais caminho para o certificado; quem manda é o
      // `uploadCertificate`, que valida senha, validade e CNPJ.
      const comExtras: Record<string, unknown> = {
        legalName: "REDE A LTDA",
        certificateKey: "qualquer-coisa.pfx",
        certificatePassword: "123",
      };
      const intruso = comExtras as UpsertInput;

      await call(fiscalConfigRoutes.upsert, intruso, {
        context: s2sContext(ownerA, orgA),
      });

      const row = await prisma.fiscalConfig.findUnique({
        where: { organizationId: orgA.id },
      });
      expect(row?.certificateKey).toBeNull();
      expect(row?.certificatePasswordEnc).toBeNull();
    });
  });

  describe("uploadCertificate", () => {
    const payload = (
      over: Partial<{
        filename: string;
        contentBase64: string;
        password: string;
      }> = {},
    ) => ({
      filename: "certificado.pfx",
      contentBase64: certA.pfx.toString("base64"),
      password: certA.password,
      ...over,
    });

    it("grava no bucket privado, cifra a senha e preenche a validade", async () => {
      const result = await call(
        fiscalConfigRoutes.uploadCertificate,
        payload(),
        {
          context: s2sContext(ownerA, orgA),
        },
      );

      expect(result.cnpj).toBe(CNPJ_A);
      expect(storage.put).toHaveBeenCalledTimes(1);

      const row = await prisma.fiscalConfig.findUnique({
        where: { organizationId: orgA.id },
      });
      expect(row?.certificateKey).toMatch(
        new RegExp(`^fiscal/${orgA.id}/certificates/.+\\.pfx$`),
      );
      expect(row?.certificateExpiresAt?.toISOString()).toBe(
        certA.notAfter.toISOString(),
      );
      // Senha NUNCA em texto claro no banco.
      expect(row?.certificatePasswordEnc).not.toBe(certA.password);
      expect(decryptString(row?.certificatePasswordEnc)).toBe(certA.password);
    });

    it("recusa senha errada com mensagem própria", async () => {
      await expect(
        call(
          fiscalConfigRoutes.uploadCertificate,
          payload({ password: "errada" }),
          { context: s2sContext(ownerA, orgA) },
        ),
      ).rejects.toThrow(/senha do certificado incorreta/i);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it("recusa certificado de outro CNPJ", async () => {
      // Certificado da Rede A sendo enviado na Rede B.
      await expect(
        call(fiscalConfigRoutes.uploadCertificate, payload(), {
          context: s2sContext(ownerB, orgB),
        }),
      ).rejects.toThrow(new RegExp(`certificado é do CNPJ ${CNPJ_A}`, "i"));
      expect(storage.put).not.toHaveBeenCalled();
    });

    it("recusa certificado vencido", async () => {
      const vencido = makeTestPfx({
        cnpj: CNPJ_A,
        notBefore: new Date("2020-01-01T00:00:00Z"),
        notAfter: new Date("2021-01-01T00:00:00Z"),
      });
      await expect(
        call(
          fiscalConfigRoutes.uploadCertificate,
          payload({ contentBase64: vencido.pfx.toString("base64") }),
          { context: s2sContext(ownerA, orgA) },
        ),
      ).rejects.toThrow(/vencido/i);
    });

    it("recusa e-CPF (certificado sem CNPJ)", async () => {
      const ecpf = makeTestPfx({ cnpj: null, razaoSocial: "FULANO" });
      await expect(
        call(
          fiscalConfigRoutes.uploadCertificate,
          payload({ contentBase64: ecpf.pfx.toString("base64") }),
          { context: s2sContext(ownerA, orgA) },
        ),
      ).rejects.toThrow(/e-CPF|e-CNPJ/i);
    });

    it("recusa arquivo que não é PKCS#12", async () => {
      await expect(
        call(
          fiscalConfigRoutes.uploadCertificate,
          payload({
            contentBase64: Buffer.from("nao sou um pfx").toString("base64"),
          }),
          { context: s2sContext(ownerA, orgA) },
        ),
      ).rejects.toThrow(/não é um certificado A1/i);
    });

    it("exige CNPJ cadastrado antes do upload", async () => {
      await prisma.fiscalConfig.update({
        where: { organizationId: orgA.id },
        data: { cnpj: null },
      });
      await expect(
        call(fiscalConfigRoutes.uploadCertificate, payload(), {
          context: s2sContext(ownerA, orgA),
        }),
      ).rejects.toThrow(/CNPJ da empresa/i);
    });

    it("recusa upload por membro comum", async () => {
      await expect(
        call(fiscalConfigRoutes.uploadCertificate, payload(), {
          context: s2sContext(caixaA, orgA),
        }),
      ).rejects.toThrow(/owner\/admin/i);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it("troca de certificado apaga o objeto anterior do bucket privado", async () => {
      await call(fiscalConfigRoutes.uploadCertificate, payload(), {
        context: s2sContext(ownerA, orgA),
      });
      const primeira = await prisma.fiscalConfig.findUnique({
        where: { organizationId: orgA.id },
      });

      await call(fiscalConfigRoutes.uploadCertificate, payload(), {
        context: s2sContext(ownerA, orgA),
      });

      expect(storage.del).toHaveBeenCalledWith(primeira?.certificateKey);
    });

    it("não apaga key legada — ela vive em outro bucket", async () => {
      await prisma.fiscalConfig.update({
        where: { organizationId: orgA.id },
        data: { certificateKey: "3f1a-certificado.pfx" },
      });

      await call(fiscalConfigRoutes.uploadCertificate, payload(), {
        context: s2sContext(ownerA, orgA),
      });

      expect(storage.del).not.toHaveBeenCalled();
    });

    it("escreve só na org do contexto", async () => {
      await call(fiscalConfigRoutes.uploadCertificate, payload(), {
        context: s2sContext(ownerA, orgA),
      });

      const b = await prisma.fiscalConfig.findUnique({
        where: { organizationId: orgB.id },
      });
      expect(b?.certificateKey).toBeNull();
    });
  });
});
