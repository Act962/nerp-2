"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Database, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  useErpConnection,
  useSaveErpConnection,
  useTestErpConnection,
} from "../hooks/use-erp-sync";

// Regex de identificador Oracle igual à do backend (o schema vira SQL).
const schema = z.object({
  host: z.string().min(1, "Informe o host"),
  port: z
    .number({ error: "Informe a porta" })
    .int()
    .positive()
    .max(65535, "Porta inválida"),
  serviceName: z.string().min(1, "Informe o service name"),
  schema: z
    .string()
    .min(1, "Informe o schema")
    .regex(/^[A-Za-z][A-Za-z0-9_$#]{0,29}$/, "Schema Oracle inválido"),
  user: z.string().min(1, "Informe o usuário"),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function WinthorConnectionForm() {
  const connectionQuery = useErpConnection();
  const save = useSaveErpConnection();
  const test = useTestErpConnection();
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const connection = connectionQuery.data;
  const hasCredentials =
    connection?.configured === true && connection.hasCredentials;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      host: "",
      port: 1521,
      serviceName: "",
      schema: "",
      user: "",
      password: "",
    },
  });

  // Preenche o formulário quando a config chega (sem a senha — placeholder
  // avisa que já existe uma e que branco a mantém).
  const { reset } = form;
  useEffect(() => {
    if (connection?.configured) {
      reset({
        host: connection.host,
        port: connection.port,
        serviceName: connection.serviceName,
        schema: connection.schema,
        user: connection.user,
        password: "",
      });
    }
  }, [connection, reset]);

  const onSubmit = (values: FormValues) => {
    setTestResult(null);
    save.mutate(values);
  };

  const onTest = () => {
    // Valida o form antes de testar; o teste usa os valores atuais dos campos.
    form.handleSubmit((values) => {
      setTestResult(null);
      test.mutate(values, {
        onSuccess: (result) =>
          setTestResult({ ok: result.ok, message: result.message }),
        onError: (error) =>
          setTestResult({ ok: false, message: error.message }),
      });
    })();
  };

  if (connectionQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Carregando…
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Controller
            control={form.control}
            name="host"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="host">Host / IP</FieldLabel>
                <Input
                  id="host"
                  placeholder="192.0.2.10"
                  autoComplete="off"
                  {...field}
                />
                {fieldState.error && (
                  <FieldError>{fieldState.error.message}</FieldError>
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="port"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="port">Porta</FieldLabel>
                <Input
                  id="port"
                  type="number"
                  inputMode="numeric"
                  placeholder="1521"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={Number.isFinite(field.value) ? field.value : ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === ""
                        ? undefined
                        : e.target.valueAsNumber,
                    )
                  }
                />
                {fieldState.error && (
                  <FieldError>{fieldState.error.message}</FieldError>
                )}
              </Field>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="serviceName"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="serviceName">Service name</FieldLabel>
                <Input
                  id="serviceName"
                  placeholder="pdb01"
                  autoComplete="off"
                  {...field}
                />
                {fieldState.error && (
                  <FieldError>{fieldState.error.message}</FieldError>
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="schema"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="schema">Schema dos dados</FieldLabel>
                <Input
                  id="schema"
                  placeholder="WINTHOR"
                  autoComplete="off"
                  {...field}
                />
                {fieldState.error && (
                  <FieldError>{fieldState.error.message}</FieldError>
                )}
              </Field>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="user"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="user">
                  Usuário (somente leitura)
                </FieldLabel>
                <Input
                  id="user"
                  placeholder="CONSULTA"
                  autoComplete="off"
                  {...field}
                />
                {fieldState.error && (
                  <FieldError>{fieldState.error.message}</FieldError>
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    hasCredentials
                      ? "•••••••• (deixe em branco p/ manter)"
                      : "Senha do banco"
                  }
                  {...field}
                />
                {fieldState.error && (
                  <FieldError>{fieldState.error.message}</FieldError>
                )}
              </Field>
            )}
          />
        </div>

        {testResult && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              testResult.ok
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/40 text-destructive",
            )}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="break-words">{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={save.isPending} className="gap-2">
            {save.isPending && <Spinner className="size-4" />}
            {hasCredentials ? "Salvar alterações" : "Conectar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={test.isPending}
            className="gap-2"
          >
            {test.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <Database className="size-4" />
            )}
            Testar conexão
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
