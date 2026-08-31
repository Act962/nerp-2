"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CircleAlert, Loader2, Plug, Unplug } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useRemoveWhatsAppConnection,
  useSaveWhatsAppConnection,
  useTestWhatsAppConnection,
  useWhatsAppConnection,
} from "../hooks/use-whatsapp-connection";

const schema = z.object({
  name: z.string().trim().min(1, "Dê um nome para esta conexão"),
  phoneNumberId: z.string().trim().min(1, "Informe o Phone Number ID"),
  businessAccountId: z.string().trim().optional(),
  accessToken: z.string().optional(),
  appSecret: z.string().optional(),
  verifyToken: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Configura o número de WhatsApp de um funil.
 *
 * Os campos de segredo vêm mascarados do servidor e ficam **vazios** no
 * formulário: em branco significa "mantém o que está guardado". É por isso que
 * o rótulo diz o que já existe em vez de mostrar o valor.
 */
export function ConexaoPanel({ funnelId }: { funnelId: string }) {
  const { data, isPending } = useWhatsAppConnection(funnelId);
  const salvar = useSaveWhatsAppConnection();
  const testar = useTestWhatsAppConnection();
  const desconectar = useRemoveWhatsAppConnection();

  const conexao = data?.conexao ?? null;
  const podeGerenciar = data?.podeGerenciar ?? false;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phoneNumberId: "",
      businessAccountId: "",
      accessToken: "",
      appSecret: "",
      verifyToken: "",
    },
  });

  const { reset } = form;
  useEffect(() => {
    if (!conexao) return;
    reset({
      name: conexao.name,
      phoneNumberId: conexao.credenciais.phoneNumberId ?? "",
      businessAccountId: conexao.credenciais.businessAccountId ?? "",
      // Segredos nunca são pré-preenchidos.
      accessToken: "",
      appSecret: "",
      verifyToken: "",
    });
  }, [conexao, reset]);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando conexão…
      </div>
    );
  }

  if (!podeGerenciar) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        Só administradores da organização podem configurar o número de WhatsApp.
      </div>
    );
  }

  const conectado = conexao?.status === "CONNECTED";

  return (
    <div className="flex flex-col gap-6">
      {conexao ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          {conectado ? (
            <Badge className="gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5">
              <CircleAlert className="size-3.5" />
              Desconectado
            </Badge>
          )}

          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {conexao.phoneNumber ?? "Número ainda não confirmado"}
            </span>
            {conexao.profileName ? (
              <span className="text-muted-foreground text-xs">
                {conexao.profileName}
              </span>
            ) : null}
          </div>

          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testar.isPending}
              onClick={() => testar.mutate({ funnelId })}
            >
              {testar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plug className="size-4" />
              )}
              Testar conexão
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={desconectar.isPending}
              onClick={() => desconectar.mutate({ funnelId })}
            >
              <Unplug className="size-4" />
              Desconectar
            </Button>
          </div>

          {conexao.lastError ? (
            <p className="w-full text-destructive text-xs">
              {conexao.lastError}
            </p>
          ) : null}
        </div>
      ) : null}

      <form
        onSubmit={form.handleSubmit((values) =>
          salvar.mutate({ funnelId, ...values }),
        )}
      >
        <FieldGroup>
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="name">Nome da conexão</FieldLabel>
                <Input
                  id="name"
                  placeholder="Ex.: Atendimento loja centro"
                  {...field}
                />
                <FieldDescription>
                  Só para você identificar este número na lista.
                </FieldDescription>
                {fieldState.error ? (
                  <FieldError>{fieldState.error.message}</FieldError>
                ) : null}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="phoneNumberId"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="phoneNumberId">Phone Number ID</FieldLabel>
                <Input id="phoneNumberId" placeholder="1234567890" {...field} />
                <FieldDescription>
                  No painel da Meta, em WhatsApp → Configuração da API. É por
                  ele que a mensagem recebida encontra este funil.
                </FieldDescription>
                {fieldState.error ? (
                  <FieldError>{fieldState.error.message}</FieldError>
                ) : null}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="businessAccountId"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="businessAccountId">
                  WhatsApp Business Account ID
                </FieldLabel>
                <Input
                  id="businessAccountId"
                  placeholder="1098765432"
                  {...field}
                />
                <FieldDescription>
                  Necessário para testar a conexão e para listar os templates
                  das campanhas.
                </FieldDescription>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="accessToken"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="accessToken">Token de acesso</FieldLabel>
                <Input
                  id="accessToken"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    conexao?.credenciais.accessToken ?? "Cole o token da Meta"
                  }
                  {...field}
                />
                <FieldDescription>
                  {conexao?.credenciais.accessToken
                    ? "Já existe um token guardado. Deixe em branco para mantê-lo."
                    : "Use um token de usuário de sistema, que não expira."}
                </FieldDescription>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="appSecret"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="appSecret">App Secret</FieldLabel>
                <Input
                  id="appSecret"
                  type="password"
                  autoComplete="off"
                  placeholder={conexao?.credenciais.appSecret ?? "••••"}
                  {...field}
                />
                <FieldDescription>
                  Assina o webhook. Sem ele, toda mensagem recebida é recusada.
                </FieldDescription>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="verifyToken"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="verifyToken">Verify Token</FieldLabel>
                <Input
                  id="verifyToken"
                  type="password"
                  autoComplete="off"
                  placeholder={conexao?.credenciais.verifyToken ?? "••••"}
                  {...field}
                />
                <FieldDescription>
                  Uma senha inventada por você, digitada igual aqui e no painel
                  da Meta, para ela provar que o webhook é seu.
                </FieldDescription>
              </Field>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {conexao ? "Salvar alterações" : "Conectar número"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}
