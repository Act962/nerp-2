"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ExternalLink,
  Landmark,
  Loader2,
  PlugZap,
  Radio,
  Save,
  Shield,
} from "lucide-react";
import {
  useFiscalConfig,
  useSaveFiscalConfig,
  useTestProvider,
  useTestSefaz,
} from "../hooks/use-fiscal-config";
import { CertificateUploader } from "./certificate-uploader";

// Sentinela que o server aceita para "não mexer neste segredo". Enquanto o
// usuário não digitar nada no campo, mandamos essa string em vez do valor
// atual (que nunca chega ao client em texto claro).
const KEEP = "__KEEP__";

type SecretField =
  | "certificatePassword"
  | "focusTokenHomolog"
  | "focusToken"
  | "csc";

export function FiscalConfigPanel() {
  const { config, isLoading } = useFiscalConfig();
  const save = useSaveFiscalConfig();
  const testSefaz = useTestSefaz();
  const testProvider = useTestProvider();

  // Form controlado, com o estado inicial semeado a partir do server.
  const [form, setForm] = useState({
    environment: "HOMOLOGACAO" as "HOMOLOGACAO" | "PRODUCAO",
    cnpj: "",
    ie: "",
    ieSt: "",
    im: "",
    taxRegime: "SIMPLES_NACIONAL" as
      | "SIMPLES_NACIONAL"
      | "SIMPLES_MEI"
      | "LUCRO_PRESUMIDO"
      | "LUCRO_REAL",
    cnae: "",
    legalName: "",
    tradeName: "",
    ufFiscal: "PI",
    cityCode: "",
    cityName: "",
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    zipCode: "",
    fiscalPhone: "",
    fiscalEmail: "",
    certificateKey: null as string | null,
    certificateFilename: null as string | null,
    // Segredos começam com o sentinela (mantém o valor atual). Só substituímos
    // se o usuário digitar algo — nesse caso mandamos o valor cru pro server
    // (que cifra) ou "" pra apagar.
    certificatePassword: KEEP,
    focusEmpresaId: "",
    focusTokenHomolog: KEEP,
    focusToken: KEEP,
    nfceSerie: 1,
    nfceNextNumber: null as number | null,
    csc: KEEP,
    cscId: "",
    emissionType: "NORMAL" as
      | "NORMAL"
      | "CONTINGENCIA_SVCAN"
      | "CONTINGENCIA_OFFLINE",
    autoPrintOnEmission: true,
  });

  useEffect(() => {
    if (!config) return;
    setForm((prev) => ({
      ...prev,
      environment: config.environment,
      cnpj: config.cnpj ?? "",
      ie: config.ie ?? "",
      ieSt: config.ieSt ?? "",
      im: config.im ?? "",
      taxRegime: config.taxRegime ?? "SIMPLES_NACIONAL",
      cnae: config.cnae ?? "",
      legalName: config.legalName ?? "",
      tradeName: config.tradeName ?? "",
      ufFiscal: config.ufFiscal,
      cityCode: config.cityCode ?? "",
      cityName: config.cityName ?? "",
      address: config.address ?? "",
      addressNumber: config.addressNumber ?? "",
      complement: config.complement ?? "",
      neighborhood: config.neighborhood ?? "",
      zipCode: config.zipCode ?? "",
      fiscalPhone: config.fiscalPhone ?? "",
      fiscalEmail: config.fiscalEmail ?? "",
      certificateKey: config.certificateKey,
      certificateFilename: config.certificateFilename,
      focusEmpresaId: config.focusEmpresaId ?? "",
      nfceSerie: config.nfceSerie ?? 1,
      nfceNextNumber: config.nfceNextNumber,
      cscId: config.cscId ?? "",
      emissionType: config.emissionType,
      autoPrintOnEmission: config.autoPrintOnEmission,
    }));
  }, [config]);

  function setSecret(field: SecretField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function submit() {
    save.mutate({
      ...form,
      // Passa null pros campos texto vazios (evita salvar "" em vez de NULL).
      cnpj: form.cnpj || null,
      ie: form.ie || null,
      ieSt: form.ieSt || null,
      im: form.im || null,
      cnae: form.cnae || null,
      legalName: form.legalName || null,
      tradeName: form.tradeName || null,
      cityCode: form.cityCode || null,
      cityName: form.cityName || null,
      address: form.address || null,
      addressNumber: form.addressNumber || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      zipCode: form.zipCode || null,
      fiscalPhone: form.fiscalPhone || null,
      fiscalEmail: form.fiscalEmail || null,
      focusEmpresaId: form.focusEmpresaId || null,
      cscId: form.cscId || null,
    });
  }

  if (isLoading || !config) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Ambiente + testes rápidos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-4" />
              Ambiente
            </CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testSefaz.mutate({})}
                disabled={testSefaz.isPending}
              >
                {testSefaz.isPending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Landmark className="mr-1 size-4" />
                )}
                Testar SEFAZ PI
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testProvider.mutate({})}
                disabled={testProvider.isPending}
              >
                {testProvider.isPending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <PlugZap className="mr-1 size-4" />
                )}
                Testar provedor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Switch
              id="env-toggle"
              checked={form.environment === "PRODUCAO"}
              onCheckedChange={(prod) =>
                set("environment", prod ? "PRODUCAO" : "HOMOLOGACAO")
              }
            />
            <Label htmlFor="env-toggle" className="cursor-pointer">
              {form.environment === "PRODUCAO" ? (
                <span className="font-semibold text-destructive">
                  PRODUÇÃO (emite nota real)
                </span>
              ) : (
                <span>Homologação (testes)</span>
              )}
            </Label>
          </div>
          <span className="text-muted-foreground">
            Webservice atual:{" "}
            <code className="rounded bg-muted px-1 text-xs">
              {config.sefazPi.webserviceStatus}
            </code>
          </span>
        </CardContent>
      </Card>

      {/* Dados fiscais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados fiscais da empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Razão social" className="sm:col-span-2">
            <Input
              value={form.legalName}
              onChange={(e) => set("legalName", e.target.value)}
            />
          </Field>
          <Field label="Nome fantasia">
            <Input
              value={form.tradeName}
              onChange={(e) => set("tradeName", e.target.value)}
            />
          </Field>
          <Field label="CNPJ">
            <Input
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="IE (Inscrição Estadual)">
            <Input
              value={form.ie}
              onChange={(e) => set("ie", e.target.value)}
            />
          </Field>
          <Field label="IE ST (opcional)">
            <Input
              value={form.ieSt}
              onChange={(e) => set("ieSt", e.target.value)}
            />
          </Field>
          <Field label="Inscrição Municipal (opcional)">
            <Input
              value={form.im}
              onChange={(e) => set("im", e.target.value)}
            />
          </Field>
          <Field label="CNAE principal">
            <Input
              value={form.cnae}
              onChange={(e) => set("cnae", e.target.value)}
              placeholder="0000000"
            />
          </Field>
          <Field label="Regime tributário">
            <Select
              value={form.taxRegime}
              onValueChange={(value) =>
                set("taxRegime", value as typeof form.taxRegime)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMPLES_NACIONAL">
                  Simples Nacional
                </SelectItem>
                <SelectItem value="SIMPLES_MEI">MEI</SelectItem>
                <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="UF fiscal">
            <Input
              value={form.ufFiscal}
              onChange={(e) => set("ufFiscal", e.target.value.toUpperCase())}
              maxLength={2}
            />
          </Field>
          <Field label="Município (nome)">
            <Input
              value={form.cityName}
              onChange={(e) => set("cityName", e.target.value)}
            />
          </Field>
          <Field label="Código IBGE do município">
            <Input
              value={form.cityCode}
              onChange={(e) => set("cityCode", e.target.value)}
              placeholder="2211001"
            />
          </Field>
          <Field label="CEP">
            <Input
              value={form.zipCode}
              onChange={(e) => set("zipCode", e.target.value)}
            />
          </Field>
          <Field label="Logradouro" className="sm:col-span-2">
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field label="Número">
            <Input
              value={form.addressNumber}
              onChange={(e) => set("addressNumber", e.target.value)}
            />
          </Field>
          <Field label="Complemento">
            <Input
              value={form.complement}
              onChange={(e) => set("complement", e.target.value)}
            />
          </Field>
          <Field label="Bairro">
            <Input
              value={form.neighborhood}
              onChange={(e) => set("neighborhood", e.target.value)}
            />
          </Field>
          <Field label="Telefone fiscal">
            <Input
              value={form.fiscalPhone}
              onChange={(e) => set("fiscalPhone", e.target.value)}
            />
          </Field>
          <Field label="E-mail fiscal" className="sm:col-span-2">
            <Input
              type="email"
              value={form.fiscalEmail}
              onChange={(e) => set("fiscalEmail", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Certificado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4" />
            Certificado digital A1
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CertificateUploader
              currentFilename={form.certificateFilename}
              currentKey={form.certificateKey}
              onUploaded={({ key, filename }) => {
                setForm((prev) => ({
                  ...prev,
                  certificateKey: key,
                  certificateFilename: filename,
                }));
              }}
            />
          </div>
          <Field label="Senha do certificado">
            <SecretInput
              hasSaved={config.hasCertificatePassword}
              mask={config.certificatePasswordMask}
              value={form.certificatePassword}
              onChange={(value) => setSecret("certificatePassword", value)}
            />
          </Field>
          <Field label="Validade (informativo, opcional)">
            <Input
              type="date"
              value={
                config.certificateExpiresAt
                  ? config.certificateExpiresAt.slice(0, 10)
                  : ""
              }
              disabled
            />
          </Field>
        </CardContent>
      </Card>

      {/* Provedor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="size-4" />
            Provedor de emissão — Focus NFe
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="ID da empresa no provedor (opcional)">
            <Input
              value={form.focusEmpresaId}
              onChange={(e) => set("focusEmpresaId", e.target.value)}
              placeholder="ex.: 5f8..."
            />
          </Field>
          <div />
          <Field label="Token (homologação)">
            <SecretInput
              hasSaved={config.hasFocusTokenHomolog}
              mask={config.focusTokenHomologMask}
              value={form.focusTokenHomolog}
              onChange={(value) => setSecret("focusTokenHomolog", value)}
            />
          </Field>
          <Field label="Token (produção)">
            <SecretInput
              hasSaved={config.hasFocusToken}
              mask={config.focusTokenMask}
              value={form.focusToken}
              onChange={(value) => setSecret("focusToken", value)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* NFCe */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">NFCe</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Série">
            <Input
              type="number"
              min={1}
              max={999}
              value={form.nfceSerie}
              onChange={(e) =>
                set("nfceSerie", Math.max(1, Number(e.target.value) || 1))
              }
            />
          </Field>
          <Field label="Próximo número (deixe vazio p/ provedor gerir)">
            <Input
              type="number"
              min={1}
              value={form.nfceNextNumber ?? ""}
              onChange={(e) =>
                set(
                  "nfceNextNumber",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            />
          </Field>
          <Field label="Tipo de emissão">
            <Select
              value={form.emissionType}
              onValueChange={(value) =>
                set("emissionType", value as typeof form.emissionType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="CONTINGENCIA_SVCAN">
                  Contingência SVC-AN
                </SelectItem>
                <SelectItem value="CONTINGENCIA_OFFLINE">
                  Contingência Offline
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="CSC (Código de Segurança do Contribuinte)">
            <SecretInput
              hasSaved={config.hasCsc}
              mask={config.cscMask}
              value={form.csc}
              onChange={(value) => setSecret("csc", value)}
            />
          </Field>
          <Field label="ID do CSC (idCsc)">
            <Input
              value={form.cscId}
              onChange={(e) => set("cscId", e.target.value)}
              placeholder="ex.: 000001"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Impressão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Impressão</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <Label
            htmlFor="auto-print"
            className="flex cursor-pointer flex-col gap-0.5"
          >
            <span>Imprimir cupom automaticamente após emissão</span>
            <span className="text-xs font-normal text-muted-foreground">
              Ao emitir uma NFCe, dispara a impressão do template padrão.
            </span>
          </Label>
          <Switch
            id="auto-print"
            checked={form.autoPrintOnEmission}
            onCheckedChange={(value) => set("autoPrintOnEmission", value)}
          />
        </CardContent>
      </Card>

      {/* Portais SEFAZ PI (info) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4" />
            SEFAZ PI — links úteis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <ExternalItem href={config.sefazPi.portalTeresina}>
            Portal SEFAZ PI (Teresina)
          </ExternalItem>
          <ExternalItem href={config.sefazPi.portalNfce}>
            Consulta pública de NFCe
          </ExternalItem>
          <ExternalItem href={config.sefazPi.portalHabilitacaoCsc}>
            Habilitar e obter CSC
          </ExternalItem>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          size="lg"
        >
          {save.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// Input para segredos: exibe a máscara ("•••• 1234") quando o usuário AINDA
// não digitou nada nesta sessão (form.<field> === KEEP). Ao começar a digitar,
// mostra o valor cru (tipado agora). Botão "limpar" apaga o segredo salvo.
function SecretInput({
  hasSaved,
  mask,
  value,
  onChange,
}: {
  hasSaved: boolean;
  mask: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isPristine = value === KEEP;
  return (
    <div className="flex gap-2">
      <Input
        type={isPristine ? "text" : "password"}
        value={isPristine ? (hasSaved ? mask : "") : value}
        placeholder={hasSaved ? "Já configurado" : "Digite o valor"}
        onFocus={() => {
          if (isPristine) onChange("");
        }}
        onChange={(e) => onChange(e.target.value)}
      />
      {hasSaved && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange("")}
          title="Apagar valor salvo"
        >
          Limpar
        </Button>
      )}
    </div>
  );
}

function ExternalItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-primary hover:underline"
    >
      <ExternalLink className="size-3.5" />
      {children}
    </a>
  );
}
