"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LINK_DE_CONVERSAO_RE } from "@nerp/site-content";
import { useEffect } from "react";
import {
  type Control,
  Controller,
  type Path,
  useForm,
  useWatch,
} from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useSaveSiteConversao,
  useSiteConversao,
} from "../hooks/use-site-admin";

/*
  O mesmo formato do `siteConversaoSchema` de `@nerp/site-content`, que o
  servidor aplica de novo. Refeito aqui pelo mesmo motivo dos pixels: o pacote
  tem a própria cópia do zod, e o `zodResolver` não aceita a de outra instância.
*/
const acao = z.enum(["astro", "whatsapp", "link"]);
const link = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || LINK_DE_CONVERSAO_RE.test(v),
    "Use um caminho do site (/solucoes) ou um endereço https://",
  );
const obrigatorio = (max: number, rotulo: string) =>
  z.string().trim().min(1, `Informe ${rotulo}`).max(max);

const exigeLink = (valor: { acao: string; link: string }) =>
  valor.acao !== "link" || valor.link !== "";
const LINK_FALTANDO = {
  message: "Informe o link do botão",
  path: ["link"],
};

const conversaoSchema = z.object({
  saida: z
    .object({
      ativo: z.boolean(),
      titulo: obrigatorio(80, "o título"),
      texto: obrigatorio(300, "o texto"),
      cupom: z.string().trim().max(40),
      botao: obrigatorio(40, "o texto do botão"),
      acao,
      link,
      umaVezPorVisitante: z.boolean(),
    })
    .refine(exigeLink, LINK_FALTANDO),
  barra: z
    .object({
      ativo: z.boolean(),
      texto: obrigatorio(120, "o texto"),
      botao: obrigatorio(40, "o texto do botão"),
      acao,
      link,
      aposRolar: z.coerce.number().int().min(0).max(90),
    })
    .refine(exigeLink, LINK_FALTANDO),
  astro: z.object({
    autoAbrir: z.boolean(),
    aposSegundos: z.coerce.number().int().min(3).max(120),
    noCelular: z.boolean(),
  }),
});

type Valores = z.input<typeof conversaoSchema>;
type Saida = z.output<typeof conversaoSchema>;

const ROTULO_DA_ACAO: Record<z.infer<typeof acao>, string> = {
  astro: "Abrir o Astro",
  whatsapp: "Abrir o WhatsApp do site",
  link: "Ir para um link",
};

/**
 * O que o site faz para não perder quem já chegou: o aviso de saída, a barra
 * fixa e o Astro que abre sozinho.
 *
 * Cada um liga separado e começa desligado. A aba Métricas mostra o efeito:
 * os botões destes recursos entram na lista de cliques com o nome do recurso.
 */
export function SiteMarketingConversao() {
  const { conversao, isLoading } = useSiteConversao();
  const save = useSaveSiteConversao();

  const form = useForm<Valores, unknown, Saida>({
    resolver: zodResolver(conversaoSchema),
  });

  useEffect(() => {
    if (conversao) form.reset(conversao);
  }, [conversao, form]);

  if (isLoading || !conversao) return <Skeleton className="h-96" />;

  const { control } = form;

  return (
    <form
      onSubmit={form.handleSubmit((valores) =>
        save.mutate({ conversao: valores }),
      )}
      className="flex flex-col gap-4"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aviso de saída</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aparece quando o mouse sai pelo topo da janela ou, no celular,
            quando a pessoa rola a página de volta para cima depressa. Só depois
            de 8 segundos no site, e uma vez por visita.
          </p>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-6 md:grid-cols-2">
            <Liga
              control={control}
              nome="saida.ativo"
              rotulo="Mostrar o aviso de saída"
            />
            <Liga
              control={control}
              nome="saida.umaVezPorVisitante"
              rotulo="Só uma vez por visitante"
              ajuda="Desligado, volta a aparecer numa visita futura."
            />
            <Texto control={control} nome="saida.titulo" rotulo="Título" />
            <Texto
              control={control}
              nome="saida.cupom"
              rotulo="Cupom (opcional)"
              ajuda="Aparece com um botão de copiar."
            />
            <Texto
              control={control}
              nome="saida.texto"
              rotulo="Texto"
              longo
              className="md:col-span-2"
            />
            <Texto
              control={control}
              nome="saida.botao"
              rotulo="Texto do botão"
            />
            <Acao control={control} grupo="saida" />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Barra fixa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Uma faixa no rodapé da tela, com um botão, que aparece depois que a
            pessoa rola parte da página. Quem fecha não vê de novo na mesma
            visita.
          </p>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-6 md:grid-cols-2">
            <Liga
              control={control}
              nome="barra.ativo"
              rotulo="Mostrar a barra fixa"
            />
            <Texto
              control={control}
              nome="barra.aposRolar"
              rotulo="Aparece depois de rolar (%)"
              tipo="number"
            />
            <Texto
              control={control}
              nome="barra.texto"
              rotulo="Texto"
              className="md:col-span-2"
            />
            <Texto
              control={control}
              nome="barra.botao"
              rotulo="Texto do botão"
            />
            <Acao control={control} grupo="barra" />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Astro abre sozinho</CardTitle>
          <p className="text-sm text-muted-foreground">
            O painel do consultor abre depois de alguns segundos na página, uma
            vez por visita. Só vale com o Astro ligado em Faixas do Astro.
          </p>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-6 md:grid-cols-2">
            <Liga
              control={control}
              nome="astro.autoAbrir"
              rotulo="Abrir o Astro sozinho"
            />
            <Texto
              control={control}
              nome="astro.aposSegundos"
              rotulo="Depois de quantos segundos"
              tipo="number"
            />
            <Liga
              control={control}
              nome="astro.noCelular"
              rotulo="Também no celular"
              ajuda="No celular o painel ocupa a tela inteira — pode incomodar mais do que ajudar."
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar conversão"}
        </Button>
      </div>
    </form>
  );
}

type Nome = Path<Valores>;

function Liga({
  control,
  nome,
  rotulo,
  ajuda,
}: {
  control: Control<Valores, unknown, Saida>;
  nome: Nome;
  rotulo: string;
  ajuda?: string;
}) {
  return (
    <Controller
      name={nome}
      control={control}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Switch
            id={`conversao-${nome}`}
            checked={field.value === true}
            onCheckedChange={field.onChange}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={`conversao-${nome}`}>{rotulo}</FieldLabel>
            {ajuda && <FieldDescription>{ajuda}</FieldDescription>}
          </div>
        </Field>
      )}
    />
  );
}

function Texto({
  control,
  nome,
  rotulo,
  ajuda,
  longo = false,
  tipo = "text",
  className,
}: {
  control: Control<Valores, unknown, Saida>;
  nome: Nome;
  rotulo: string;
  ajuda?: string;
  longo?: boolean;
  tipo?: "text" | "number";
  className?: string;
}) {
  return (
    <Controller
      name={nome}
      control={control}
      render={({ field, fieldState }) => {
        const props = {
          id: `conversao-${nome}`,
          name: field.name,
          value: field.value === undefined ? "" : String(field.value),
          onChange: field.onChange,
          onBlur: field.onBlur,
          "aria-invalid": fieldState.invalid,
        };
        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            <FieldLabel htmlFor={props.id}>{rotulo}</FieldLabel>
            {longo ? (
              <Textarea {...props} rows={3} />
            ) : (
              <Input {...props} type={tipo} />
            )}
            {ajuda && <FieldDescription>{ajuda}</FieldDescription>}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        );
      }}
    />
  );
}

/** A ação do botão e, quando é link, o endereço. */
function Acao({
  control,
  grupo,
}: {
  control: Control<Valores, unknown, Saida>;
  grupo: "saida" | "barra";
}) {
  const escolhida = useWatch({ control, name: `${grupo}.acao` });
  return (
    <div className="flex flex-col gap-6">
      <Controller
        name={`${grupo}.acao`}
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor={`conversao-${grupo}-acao`}>
              O botão faz
            </FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`conversao-${grupo}-acao`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {acao.options.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {ROTULO_DA_ACAO[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />
      {escolhida === "link" && (
        <Texto control={control} nome={`${grupo}.link`} rotulo="Link" />
      )}
    </div>
  );
}
