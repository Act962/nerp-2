import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import {
  CertificateError,
  isExpired,
  matchesCnpj,
  parsePfx,
} from "@/lib/fiscal/certificate";
import {
  decryptString,
  encryptString,
  maskSecret,
} from "@/lib/fiscal/encryption";
import { pingFocus } from "@/lib/fiscal/focus-nfe";
import { SEFAZ_PI, pingSefazNfce } from "@/lib/fiscal/sefaz-pi";
import {
  FISCAL_KEY_PREFIX,
  certificateObjectKey,
  deleteFiscalObject,
  putFiscalObject,
} from "@/lib/fiscal/storage";
import { z } from "zod";

const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

// Sentinela para "não mudei este segredo" — o client envia isso quando o
// usuário deixou o campo em branco (não sobrescreve o que já existe).
const SENTINEL_KEEP = "__KEEP__";

// Só owner/admin editam a configuração fiscal.
async function requireManage(
  orgId: string,
  userId: string,
  errors: { FORBIDDEN: (o: { message: string }) => Error },
) {
  const member = await prisma.member.findFirst({
    where: { organizationId: orgId, userId },
    select: { role: true },
  });
  if (!member || !hasFullAccess(member.role))
    throw errors.FORBIDDEN({
      message: "Apenas owner/admin gerenciam configuração fiscal",
    });
}

const configOutput = z.object({
  id: z.string().nullable(),
  environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
  cnpj: z.string().nullable(),
  ie: z.string().nullable(),
  ieSt: z.string().nullable(),
  im: z.string().nullable(),
  taxRegime: z
    .enum(["SIMPLES_NACIONAL", "SIMPLES_MEI", "LUCRO_PRESUMIDO", "LUCRO_REAL"])
    .nullable(),
  cnae: z.string().nullable(),
  legalName: z.string().nullable(),
  tradeName: z.string().nullable(),
  ufFiscal: z.string(),
  cityCode: z.string().nullable(),
  cityName: z.string().nullable(),
  address: z.string().nullable(),
  addressNumber: z.string().nullable(),
  complement: z.string().nullable(),
  neighborhood: z.string().nullable(),
  zipCode: z.string().nullable(),
  fiscalPhone: z.string().nullable(),
  fiscalEmail: z.string().nullable(),
  // A `certificateKey` NÃO sai daqui: com ela na mão o client conseguia baixar
  // o .pfx direto do bucket. O client só precisa saber SE existe certificado.
  hasCertificate: z.boolean(),
  certificateFilename: z.string().nullable(),
  certificateExpiresAt: z.string().nullable(),
  // Certificado ainda apontando para o bucket público antigo: precisa ser
  // reenviado antes de qualquer emissão.
  certificateStorageLegacy: z.boolean(),
  // Segredos: NUNCA voltam em texto claro. Só uma máscara ("•••• 1234")
  // indicando que estão preenchidos.
  //
  // A senha do certificado é a exceção: nem máscara. Token de provedor com os
  // 4 últimos à mostra ajuda a conferir qual credencial está gravada; senha de
  // certificado com 4 caracteres à mostra é só encurtar a busca de quem tentar
  // adivinhá-la, e ninguém mais consulta esse campo desde que o upload passou
  // a receber a senha junto com o arquivo.
  hasCertificatePassword: z.boolean(),
  provider: z.enum(["FOCUS_NFE"]),
  focusEmpresaId: z.string().nullable(),
  hasFocusTokenHomolog: z.boolean(),
  focusTokenHomologMask: z.string(),
  hasFocusToken: z.boolean(),
  focusTokenMask: z.string(),
  nfceSerie: z.number().nullable(),
  nfceNextNumber: z.number().nullable(),
  hasCsc: z.boolean(),
  cscMask: z.string(),
  cscId: z.string().nullable(),
  emissionType: z.enum([
    "NORMAL",
    "CONTINGENCIA_SVCAN",
    "CONTINGENCIA_OFFLINE",
  ]),
  autoPrintOnEmission: z.boolean(),
  defaultReceiptTemplateId: z.string().nullable(),
  // Info fixa da SEFAZ PI — o client mostra os links.
  sefazPi: z.object({
    uf: z.string(),
    cityCode: z.string(),
    cityName: z.string(),
    portalTeresina: z.string(),
    portalNfce: z.string(),
    portalHabilitacaoCsc: z.string(),
    webserviceStatus: z.string(),
  }),
});

const get = p
  .input(z.object({}).optional())
  .output(configOutput)
  .handler(async ({ context, errors }) => {
    // A configuração fiscal expõe máscaras de segredo e metadados do
    // certificado — leitura é tão sensível quanto escrita.
    await requireManage(context.org.id, context.user.id, errors);

    const row = await prisma.fiscalConfig.findUnique({
      where: { organizationId: context.org.id },
    });

    const env = row?.environment ?? "HOMOLOGACAO";
    return {
      id: row?.id ?? null,
      environment: env,
      cnpj: row?.cnpj ?? null,
      ie: row?.ie ?? null,
      ieSt: row?.ieSt ?? null,
      im: row?.im ?? null,
      taxRegime: row?.taxRegime ?? null,
      cnae: row?.cnae ?? null,
      legalName: row?.legalName ?? null,
      tradeName: row?.tradeName ?? null,
      ufFiscal: row?.ufFiscal ?? "PI",
      cityCode: row?.cityCode ?? SEFAZ_PI.cityCode,
      cityName: row?.cityName ?? SEFAZ_PI.cityName,
      address: row?.address ?? null,
      addressNumber: row?.addressNumber ?? null,
      complement: row?.complement ?? null,
      neighborhood: row?.neighborhood ?? null,
      zipCode: row?.zipCode ?? null,
      fiscalPhone: row?.fiscalPhone ?? null,
      fiscalEmail: row?.fiscalEmail ?? null,
      hasCertificate: !!row?.certificateKey,
      certificateFilename: row?.certificateFilename ?? null,
      certificateExpiresAt: row?.certificateExpiresAt?.toISOString() ?? null,
      certificateStorageLegacy:
        !!row?.certificateKey &&
        !row.certificateKey.startsWith(FISCAL_KEY_PREFIX),
      hasCertificatePassword: !!row?.certificatePasswordEnc,
      provider: row?.provider ?? "FOCUS_NFE",
      focusEmpresaId: row?.focusEmpresaId ?? null,
      hasFocusTokenHomolog: !!row?.focusTokenHomolog,
      focusTokenHomologMask: row?.focusTokenHomolog
        ? maskSecret(safeDecrypt(row.focusTokenHomolog))
        : "",
      hasFocusToken: !!row?.focusToken,
      focusTokenMask: row?.focusToken
        ? maskSecret(safeDecrypt(row.focusToken))
        : "",
      nfceSerie: row?.nfceSerie ?? 1,
      nfceNextNumber: row?.nfceNextNumber ?? null,
      hasCsc: !!row?.csc,
      cscMask: row?.csc ? maskSecret(safeDecrypt(row.csc)) : "",
      cscId: row?.cscId ?? null,
      emissionType: row?.emissionType ?? "NORMAL",
      autoPrintOnEmission: row?.autoPrintOnEmission ?? true,
      defaultReceiptTemplateId: row?.defaultReceiptTemplateId ?? null,
      sefazPi: {
        uf: SEFAZ_PI.uf,
        cityCode: SEFAZ_PI.cityCode,
        cityName: SEFAZ_PI.cityName,
        portalTeresina: SEFAZ_PI.portalTeresina,
        portalNfce: SEFAZ_PI.portalNfce,
        portalHabilitacaoCsc: SEFAZ_PI.portalHabilitacaoCsc,
        webserviceStatus: SEFAZ_PI.webservicesNfce[env].status,
      },
    };
  });

// Segredos são "keep unless overridden": o cliente manda `__KEEP__` para
// preservar o valor atual, ou string vazia pra apagar, ou o novo valor cru.
const secretString = z.string().optional().nullable();

const upsertInput = z.object({
  environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]).optional(),
  cnpj: z.string().nullable().optional(),
  ie: z.string().nullable().optional(),
  ieSt: z.string().nullable().optional(),
  im: z.string().nullable().optional(),
  taxRegime: z
    .enum(["SIMPLES_NACIONAL", "SIMPLES_MEI", "LUCRO_PRESUMIDO", "LUCRO_REAL"])
    .nullable()
    .optional(),
  cnae: z.string().nullable().optional(),
  legalName: z.string().nullable().optional(),
  tradeName: z.string().nullable().optional(),
  ufFiscal: z.string().min(2).max(2).optional(),
  cityCode: z.string().nullable().optional(),
  cityName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  addressNumber: z.string().nullable().optional(),
  complement: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  fiscalPhone: z.string().nullable().optional(),
  fiscalEmail: z.string().nullable().optional(),

  // O certificado NÃO entra aqui: arquivo, senha e validade são gravados por
  // `uploadCertificate`, que é quem consegue validar os três juntos.

  focusEmpresaId: z.string().nullable().optional(),
  focusTokenHomolog: secretString,
  focusToken: secretString,

  nfceSerie: z.number().int().min(1).max(999).nullable().optional(),
  nfceNextNumber: z.number().int().min(1).nullable().optional(),
  csc: secretString,
  cscId: z.string().nullable().optional(),
  emissionType: z
    .enum(["NORMAL", "CONTINGENCIA_SVCAN", "CONTINGENCIA_OFFLINE"])
    .optional(),

  autoPrintOnEmission: z.boolean().optional(),
  defaultReceiptTemplateId: z.string().nullable().optional(),
});

const upsert = p
  .input(upsertInput)
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);

    // Segredos: aplica a lógica "keep/set/clear".
    const secretPatch: Record<string, string | null | undefined> = {};
    applySecret(secretPatch, "focusTokenHomolog", input.focusTokenHomolog);
    applySecret(secretPatch, "focusToken", input.focusToken);
    applySecret(secretPatch, "csc", input.csc);

    const writable = {
      environment: input.environment,
      cnpj: input.cnpj,
      ie: input.ie,
      ieSt: input.ieSt,
      im: input.im,
      taxRegime: input.taxRegime,
      cnae: input.cnae,
      legalName: input.legalName,
      tradeName: input.tradeName,
      ufFiscal: input.ufFiscal,
      cityCode: input.cityCode,
      cityName: input.cityName,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement,
      neighborhood: input.neighborhood,
      zipCode: input.zipCode,
      fiscalPhone: input.fiscalPhone,
      fiscalEmail: input.fiscalEmail,
      focusEmpresaId: input.focusEmpresaId,
      nfceSerie: input.nfceSerie,
      nfceNextNumber: input.nfceNextNumber,
      cscId: input.cscId,
      emissionType: input.emissionType,
      autoPrintOnEmission: input.autoPrintOnEmission,
      defaultReceiptTemplateId: input.defaultReceiptTemplateId,
      ...secretPatch,
    };

    const cleaned = pruneUndefined(writable);
    await prisma.fiscalConfig.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        // Defaults só se o input não vier — evita undefined em coluna NOT NULL.
        environment: input.environment ?? "HOMOLOGACAO",
        ufFiscal: input.ufFiscal ?? "PI",
        ...cleaned,
      },
      update: cleaned,
    });

    return { ok: true };
  });

/**
 * Teto do .pfx. Um A1 tem poucos KB — 64KB já é folgado e mantém o base64
 * dentro do que o oRPC transporta sem presigned URL.
 */
const MAX_PFX_BYTES = 64 * 1024;

/**
 * Recebe o certificado A1, VALIDA e grava no bucket fiscal privado.
 *
 * Por que o upload passa por aqui e não pelo presigned de `/api/s3/upload`:
 * a senha é indispensável para abrir o .pfx, e só abrindo dá para conferir
 * validade e CNPJ. Validar aqui transforma "certificado errado" em erro de
 * tela; validar só na primeira venda transformaria em incidente fiscal.
 *
 * A senha chega crua (sob TLS), é usada para abrir o arquivo e sai daqui
 * cifrada — nunca é devolvida ao client.
 */
const uploadCertificate = p
  .input(
    z.object({
      filename: z.string().min(1).max(200),
      /** Conteúdo do .pfx em base64. */
      contentBase64: z.string().min(1),
      password: z.string().min(1, "Informe a senha do certificado"),
    }),
  )
  .output(
    z.object({
      filename: z.string(),
      expiresAt: z.string(),
      subjectName: z.string(),
      cnpj: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);

    const config = await prisma.fiscalConfig.findUnique({
      where: { organizationId: context.org.id },
      select: { cnpj: true, certificateKey: true },
    });
    if (!config?.cnpj)
      throw errors.BAD_REQUEST({
        message:
          "Cadastre e salve o CNPJ da empresa antes de enviar o certificado.",
      });

    const pfx = Buffer.from(input.contentBase64, "base64");
    if (pfx.length === 0)
      throw errors.BAD_REQUEST({ message: "Arquivo vazio" });
    if (pfx.length > MAX_PFX_BYTES)
      throw errors.BAD_REQUEST({
        message: "Arquivo grande demais para um certificado A1 (máx. 64KB)",
      });

    let parsed: ReturnType<typeof parsePfx>;
    try {
      parsed = parsePfx(pfx, input.password);
    } catch (error) {
      if (error instanceof CertificateError)
        throw errors.BAD_REQUEST({ message: error.message });
      throw error;
    }

    if (isExpired(parsed, new Date()))
      throw errors.BAD_REQUEST({
        message: `Certificado vencido em ${parsed.notAfter.toLocaleDateString("pt-BR")}. Envie um certificado válido.`,
      });

    if (!matchesCnpj(parsed, config.cnpj))
      throw errors.BAD_REQUEST({
        message: parsed.cnpj
          ? `O certificado é do CNPJ ${parsed.cnpj}, diferente do cadastrado nesta empresa.`
          : "O certificado não tem CNPJ (parece um e-CPF). A emissão exige um e-CNPJ A1.",
      });

    const key = certificateObjectKey(context.org.id);
    await putFiscalObject(key, pfx, "application/x-pkcs12");

    // Só grava a referência depois que o objeto subiu: falha no meio deixa um
    // órfão no bucket, nunca uma linha apontando para arquivo inexistente.
    await prisma.fiscalConfig.update({
      where: { organizationId: context.org.id },
      data: {
        certificateKey: key,
        certificateFilename: input.filename.replace(/[^\w.\- ]/g, "_"),
        certificateExpiresAt: parsed.notAfter,
        certificatePasswordEnc: encryptString(input.password),
      },
    });

    // Certificado antigo some do bucket. Keys legadas (do bucket público de
    // imagens) não são apagadas aqui — vivem em outro bucket e precisam de
    // limpeza manual no R2.
    const previous = config.certificateKey;
    if (previous?.startsWith(FISCAL_KEY_PREFIX) && previous !== key)
      await deleteFiscalObject(previous);

    return {
      filename: input.filename,
      expiresAt: parsed.notAfter.toISOString(),
      subjectName: parsed.subjectName,
      cnpj: parsed.cnpj ?? "",
    };
  });

const testSefaz = p
  .output(
    z.object({
      ok: z.boolean(),
      status: z.number(),
      latencyMs: z.number(),
      url: z.string(),
      message: z.string().nullable(),
    }),
  )
  .handler(async ({ context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    const row = await prisma.fiscalConfig.findUnique({
      where: { organizationId: context.org.id },
      select: { environment: true },
    });
    const result = await pingSefazNfce(row?.environment ?? "HOMOLOGACAO");
    return { ...result, message: result.message ?? null };
  });

const testProvider = p
  .output(
    z.object({
      ok: z.boolean(),
      status: z.number(),
      latencyMs: z.number(),
      message: z.string().nullable(),
    }),
  )
  .handler(async ({ context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    const row = await prisma.fiscalConfig.findUnique({
      where: { organizationId: context.org.id },
    });
    if (!row)
      throw errors.NOT_FOUND({
        message: "Configuração fiscal ainda não existe",
      });
    const env = row.environment;
    const tokenEnc =
      env === "PRODUCAO" ? row.focusToken : row.focusTokenHomolog;
    if (!tokenEnc)
      return {
        ok: false,
        status: 0,
        latencyMs: 0,
        message: `Token do Focus NFe (${env.toLowerCase()}) ainda não configurado`,
      };
    const token = safeDecrypt(tokenEnc);
    const result = await pingFocus(env, token, row.focusEmpresaId);
    return {
      ok: result.ok,
      status: result.status,
      latencyMs: result.latencyMs,
      message: result.message ?? null,
    };
  });

export const fiscalConfigRoutes = {
  get,
  upsert,
  uploadCertificate,
  testSefaz,
  testProvider,
};

// ── helpers locais ──────────────────────────────────────────────────────────

function applySecret(
  patch: Record<string, string | null | undefined>,
  field: string,
  value: string | null | undefined,
) {
  if (value === undefined || value === SENTINEL_KEEP) return; // preserva
  if (value === null || value === "") {
    patch[field] = null;
    return;
  }
  patch[field] = encryptString(value);
}

function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

// Decrypt tolerante — se a chave-mestra mudou ou o valor está corrompido, não
// derruba o handler; devolve string vazia (o client mostra "vazio").
function safeDecrypt(encoded: string): string {
  try {
    return decryptString(encoded);
  } catch {
    return "";
  }
}
