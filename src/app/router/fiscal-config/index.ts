import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import {
  decryptString,
  encryptString,
  maskSecret,
} from "@/lib/fiscal/encryption";
import { pingFocus } from "@/lib/fiscal/focus-nfe";
import { SEFAZ_PI, pingSefazNfce } from "@/lib/fiscal/sefaz-pi";
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
  certificateKey: z.string().nullable(),
  certificateFilename: z.string().nullable(),
  certificateExpiresAt: z.string().nullable(),
  // Segredos: NUNCA voltam em texto claro. Só uma máscara ("•••• 1234")
  // indicando que estão preenchidos.
  hasCertificatePassword: z.boolean(),
  certificatePasswordMask: z.string(),
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
  .handler(async ({ context }) => {
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
      certificateKey: row?.certificateKey ?? null,
      certificateFilename: row?.certificateFilename ?? null,
      certificateExpiresAt: row?.certificateExpiresAt?.toISOString() ?? null,
      hasCertificatePassword: !!row?.certificatePasswordEnc,
      certificatePasswordMask: row?.certificatePasswordEnc
        ? maskSecret(safeDecrypt(row.certificatePasswordEnc))
        : "",
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

  // Certificado: `certificateKey` só é atualizado se enviado (upload novo).
  certificateKey: z.string().nullable().optional(),
  certificateFilename: z.string().nullable().optional(),
  certificateExpiresAt: z.string().nullable().optional(),
  certificatePassword: secretString,

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
    applySecret(
      secretPatch,
      "certificatePasswordEnc",
      input.certificatePassword,
    );
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
      certificateKey: input.certificateKey,
      certificateFilename: input.certificateFilename,
      certificateExpiresAt: input.certificateExpiresAt
        ? new Date(input.certificateExpiresAt)
        : input.certificateExpiresAt === null
          ? null
          : undefined,
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
