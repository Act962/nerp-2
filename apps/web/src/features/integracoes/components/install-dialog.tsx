"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { WinthorPanel } from "@/features/erp-sync/components/winthor-panel";
import { FiscalConfigPanel } from "@/features/fiscal-config/components/fiscal-config-panel";
import { GoogleDriveCard } from "@/features/google-drive/components/google-drive-card";
import { OrbitaCrmPanel } from "./orbita-crm-panel";
import { cn } from "@/lib/utils";
import { ehSegredo } from "../catalog";
import type { ProviderManifest } from "../catalog/types";
import {
  useInstalarIntegracao,
  usePreviaIntegracao,
  useRemoverIntegracao,
  useTestarIntegracao,
} from "../hooks/use-integracoes";
import type { Instalacao } from "./provider-card";
import { ProviderLogo } from "./provider-logo";

type Props = {
  manifest: ProviderManifest;
  instalacao: Instalacao | null;
  valoresSalvos: Record<string, string>;
  logoKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InstallDialog({
  manifest,
  instalacao,
  valoresSalvos,
  logoKey,
  open,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ProviderLogo manifest={manifest} logoKey={logoKey} />
            <div className="min-w-0">
              <DialogTitle>{manifest.nome}</DialogTitle>
              <DialogDescription>{manifest.resumo}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {manifest.painelProprio ? (
          <PainelNativo qual={manifest.painelProprio} />
        ) : (
          <FormularioDeCredenciais
            manifest={manifest}
            instalacao={instalacao}
            valoresSalvos={valoresSalvos}
            onPronto={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// As três integrações anteriores ao catálogo mantêm o painel que já tinham —
// entram no mesmo grid sem serem reescritas.
function PainelNativo({
  qual,
}: {
  qual: NonNullable<ProviderManifest["painelProprio"]>;
}) {
  if (qual === "winthor") return <WinthorPanel />;
  if (qual === "fiscal") return <FiscalConfigPanel />;
  if (qual === "google-drive") return <GoogleDriveCard />;
  return <OrbitaCrmPanel />;
}

function FormularioDeCredenciais({
  manifest,
  instalacao,
  valoresSalvos,
  onPronto,
}: {
  manifest: ProviderManifest;
  instalacao: Instalacao | null;
  valoresSalvos: Record<string, string>;
  onPronto: () => void;
}) {
  const instalar = useInstalarIntegracao();
  const testar = useTestarIntegracao();
  const remover = useRemoverIntegracao();
  const previa = usePreviaIntegracao();
  const [resultadoTeste, setResultadoTeste] = useState<{
    ok: boolean;
    mensagem: string;
  } | null>(null);

  const jaInstalado = instalacao !== null;

  // Segredo guardado pode ficar em branco na edição — o servidor mantém o
  // valor cifrado. Campo de texto continua obrigatório.
  const schema = useMemo(() => {
    const shape: Record<string, z.ZodString> = {};
    for (const campo of manifest.auth.campos) {
      const podeFicarVazio =
        campo.opcional || (jaInstalado && ehSegredo(campo.tipo));
      shape[campo.key] = podeFicarVazio
        ? z.string()
        : z.string().min(1, `Informe ${campo.label.toLowerCase()}.`);
    }
    return z.object(shape);
  }, [manifest, jaInstalado]);

  // Segredo salvo chega mascarado (`••••4321`) e não pode prefill: seria
  // reenviado como se fosse a credencial.
  const defaultValues = useMemo(
    () =>
      Object.fromEntries(
        manifest.auth.campos.map((campo) => [
          campo.key,
          ehSegredo(campo.tipo) ? "" : (valoresSalvos[campo.key] ?? ""),
        ]),
      ),
    [manifest, valoresSalvos],
  );

  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setResultadoTeste(null);
  }, [defaultValues, form]);

  const entrada = (valores: Record<string, string>) => ({
    providerId: manifest.id,
    externalRef: "",
    environment: "producao" as const,
    valores,
  });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit(async (valores) => {
        await instalar.mutateAsync(entrada(valores));
        onPronto();
      })}
    >
      {manifest.preRequisito && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-400">
          {manifest.preRequisito}
        </p>
      )}

      <FieldGroup>
        {manifest.auth.campos.map((campo) => (
          <Controller
            key={campo.key}
            control={form.control}
            name={campo.key}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`campo-${campo.key}`}>
                  {campo.label}
                </FieldLabel>
                {campo.tipo === "file" ? (
                  <ArquivoPem
                    id={`campo-${campo.key}`}
                    aceita={campo.aceita}
                    preenchido={Boolean(field.value)}
                    onConteudo={field.onChange}
                  />
                ) : (
                  <Input
                    id={`campo-${campo.key}`}
                    type={campo.tipo === "password" ? "password" : "text"}
                    autoComplete="off"
                    placeholder={
                      jaInstalado && ehSegredo(campo.tipo)
                        ? "•••• (mantém o atual)"
                        : campo.placeholder
                    }
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
                {campo.ajuda && (
                  <FieldDescription>{campo.ajuda}</FieldDescription>
                )}
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ))}
      </FieldGroup>

      {resultadoTeste && (
        <p
          className={cn(
            "rounded-md px-3 py-2 text-xs",
            resultadoTeste.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {resultadoTeste.mensagem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={testar.isPending}
          onClick={async () => {
            const valores = form.getValues();
            setResultadoTeste(await testar.mutateAsync(entrada(valores)));
          }}
        >
          {testar.isPending ? "Testando…" : "Testar conexão"}
        </Button>
        <Button type="submit" disabled={instalar.isPending}>
          {jaInstalado ? "Salvar" : "Conectar"}
        </Button>
        {manifest.docsUrl && (
          <a
            href={manifest.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
          >
            Documentação do provedor
          </a>
        )}
      </div>

      {instalacao && (
        <>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            {manifest.capacidades.includes("extrato") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={previa.isPending}
                onClick={() => previa.mutate({ id: instalacao.id })}
              >
                {previa.isPending ? "Buscando…" : "Ver prévia do extrato"}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={remover.isPending}
              onClick={async () => {
                if (
                  window.confirm(
                    "Remover a integração? As credenciais serão apagadas.",
                  )
                ) {
                  await remover.mutateAsync({ id: instalacao.id });
                  onPronto();
                }
              }}
            >
              Remover
            </Button>
          </div>
          {previa.data && <Previa dados={previa.data} />}
        </>
      )}
    </form>
  );
}

function Previa({
  dados,
}: {
  dados: {
    ok: boolean;
    dias: number;
    total: number;
    movimentos: {
      data: string;
      descricao: string;
      valorCentavos: number;
    }[];
    mensagem?: string;
  };
}) {
  if (!dados.ok) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
        {dados.mensagem}
      </p>
    );
  }
  if (dados.total === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Nenhum lançamento nos últimos {dados.dias} dias.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs">
        {dados.total} lançamento{dados.total === 1 ? "" : "s"} nos últimos{" "}
        {dados.dias} dias.
      </p>
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {dados.movimentos.map((m, i) => (
          <div
            key={`${m.data}-${i}`}
            className="flex items-center justify-between gap-3 border-b px-3 py-1.5 text-xs last:border-b-0"
          >
            <span className="shrink-0 text-muted-foreground">
              {m.data.split("-").reverse().join("/")}
            </span>
            <span className="min-w-0 flex-1 truncate">{m.descricao}</span>
            <span
              className={cn(
                "shrink-0 tabular-nums",
                m.valorCentavos < 0 ? "text-destructive" : "text-emerald-600",
              )}
            >
              {(m.valorCentavos / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// O valor do campo é o CONTEÚDO do arquivo, não o arquivo: certificado e chave
// viajam como texto PEM e são cifrados junto das demais credenciais.
function ArquivoPem({
  id,
  aceita,
  preenchido,
  onConteudo,
}: {
  id: string;
  aceita?: string[];
  preenchido: boolean;
  onConteudo: (conteudo: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        type="file"
        accept={aceita?.join(",")}
        className="file:mr-2 file:text-muted-foreground file:text-xs"
        onChange={async (event) => {
          const arquivo = event.target.files?.[0];
          if (arquivo) onConteudo(await arquivo.text());
        }}
      />
      {preenchido && (
        <span className="text-emerald-600 text-xs dark:text-emerald-500">
          Arquivo carregado.
        </span>
      )}
    </div>
  );
}
