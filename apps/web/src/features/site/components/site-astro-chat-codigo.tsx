"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useSaveSiteAstroChat,
  useSiteAstroChat,
} from "../hooks/use-site-admin";

/**
 * Onde se cola o código do ASTRO CHAT.
 *
 * Com o código aqui, quem atende em orbitatec.com.br é o ASTRO do Órbita — o
 * mesmo widget que qualquer cliente do Órbita instala no próprio site —, e o
 * consultor que vem neste repositório deixa de ser desenhado. Toda conversa
 * do site passa a nascer no Chat do Órbita, no canal ASTRO CHAT.
 *
 * O campo recebe a linha de instalação inteira, do jeito que o Órbita entrega,
 * e não "a chave": quem configura copia o que vê na tela de lá. A linha não é
 * despejada no HTML do site — dela sai a chave, e o endereço do script é
 * montado do lado de cá.
 *
 * Salvar testa na hora contra o Órbita. Descobrir que o domínio não está
 * liberado só quando o widget não aparecer no site seria tarde demais.
 */

const schema = z.object({
  codigo: z
    .string()
    .max(600, "O código do ASTRO CHAT é bem mais curto que isto"),
});

type Formulario = z.infer<typeof schema>;

type Motivo =
  | "chave_desconhecida"
  | "dominio_nao_permitido"
  | "pausado"
  | "sem_tracking"
  | "indisponivel";

function explicar(motivo: Motivo, dominio: string): string {
  switch (motivo) {
    case "chave_desconhecida":
      return "O Órbita não reconheceu esta chave. Se ela foi trocada lá, copie o código de novo.";
    case "dominio_nao_permitido":
      return `O domínio ${dominio} não está na lista de domínios permitidos do site cadastrado no ASTRO CHAT. Inclua-o lá e salve de novo aqui.`;
    case "pausado":
      return "O site está desligado ou pausado no ASTRO CHAT. Ligue-o lá para o ASTRO aparecer.";
    case "sem_tracking":
      return "O site cadastrado no ASTRO CHAT está sem tracking de destino. Escolha um na aba Site e destino.";
    case "indisponivel":
      return "Não consegui falar com o Órbita agora para conferir. O código ficou salvo; salve de novo mais tarde para testar.";
  }
}

export function SiteAstroChatCodigo() {
  const { astroChat, isLoading } = useSiteAstroChat();
  const salvar = useSaveSiteAstroChat();

  const form = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: "" },
  });

  // O formulário só recebe o valor quando o `get` responde; antes disso o
  // campo vazio seria lido como "nada salvo".
  useEffect(() => {
    if (astroChat) form.reset({ codigo: astroChat.codigo });
  }, [astroChat, form]);

  const resultado = salvar.data;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">ASTRO do Órbita no site</CardTitle>
          {astroChat && (
            <Badge variant={astroChat.ligado ? "default" : "secondary"}>
              {astroChat.ligado ? "No site" : "Desligado"}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Cole aqui o código de instalação do ASTRO CHAT. Com ele, quem atende
          em orbitatec.com.br é o ASTRO do Órbita, e toda conversa do site cai
          no Chat de lá. O Astro consultor deste painel sai do site enquanto o
          código estiver salvo.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-28" />}

        {!isLoading && astroChat && (
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((dados) =>
              salvar.mutate({ codigo: dados.codigo }),
            )}
          >
            <Controller
              name="codigo"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="astro-chat-codigo">
                    Código do ASTRO CHAT
                  </FieldLabel>
                  <Textarea
                    id="astro-chat-codigo"
                    className="min-h-20 font-mono text-xs"
                    placeholder={`<script src="${astroChat.servidor}/api/astro-chat/loader.js" data-key="ac_pk_…" async></script>`}
                    spellCheck={false}
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldDescription>
                    Está em{" "}
                    <a
                      className="underline"
                      href={`${astroChat.servidor}/astro-chat`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Órbita → ASTRO CHAT
                    </a>
                    , no site cadastrado, aba Instalação. O domínio{" "}
                    <code className="rounded bg-muted px-1">
                      {astroChat.dominio}
                    </code>{" "}
                    precisa estar entre os permitidos de lá. Campo em branco
                    devolve o site ao Astro consultor.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {resultado && !resultado.ligado && (
              <output className="block text-muted-foreground text-sm">
                Código removido. O site volta a ser atendido pelo Astro
                consultor em até cinco minutos.
              </output>
            )}

            {resultado?.teste?.ok && (
              <output className="block text-emerald-600 text-sm">
                Conectado
                {resultado.teste.empresa
                  ? ` ao ASTRO CHAT de ${resultado.teste.empresa}`
                  : " ao ASTRO CHAT"}
                . O ASTRO do Órbita aparece no site em até cinco minutos.
              </output>
            )}

            {resultado?.teste && !resultado.teste.ok && (
              <p className="text-destructive text-sm" role="alert">
                {explicar(resultado.teste.motivo, astroChat.dominio)}
              </p>
            )}

            <div>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando e testando…" : "Salvar e testar"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
