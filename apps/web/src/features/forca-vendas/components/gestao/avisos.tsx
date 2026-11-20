"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  useAvisosGestao,
  useEncerrarAvisoGestao,
  usePublicarAvisoGestao,
  useVendedoresGestao,
} from "../../hooks/use-gestao-fv";
import { formatarDataHora } from "../../lib/formatar";

const avisoSchema = z
  .object({
    titulo: z.string().trim().min(3, "Dê um título ao aviso").max(120),
    corpo: z.string().trim().min(1, "Escreva o aviso").max(4000),
    link: z.union([z.literal(""), z.string().url("Link inválido")]),
    prioridade: z.enum(["NORMAL", "IMPORTANTE", "URGENTE"]),
    exigeConfirmacao: z.boolean(),
    publico: z.enum(["TODOS", "MEMBROS"]),
    memberIds: z.array(z.string()),
    fimEm: z.string(),
  })
  .refine((aviso) => aviso.publico === "TODOS" || aviso.memberIds.length > 0, {
    message: "Escolha ao menos um vendedor",
    path: ["memberIds"],
  });

type Aviso = z.infer<typeof avisoSchema>;

const VAZIO: Aviso = {
  titulo: "",
  corpo: "",
  link: "",
  prioridade: "NORMAL",
  exigeConfirmacao: false,
  publico: "TODOS",
  memberIds: [],
  fimEm: "",
};

function NovoAviso() {
  const publicar = usePublicarAvisoGestao();
  const { data: vendedores = [] } = useVendedoresGestao();
  const form = useForm<Aviso>({
    resolver: zodResolver(avisoSchema),
    defaultValues: VAZIO,
  });
  const publico = form.watch("publico");
  const prioridade = form.watch("prioridade");

  const onSubmit = (dados: Aviso) =>
    publicar.mutate(
      {
        titulo: dados.titulo,
        corpo: dados.corpo,
        link: dados.link || null,
        prioridade: dados.prioridade,
        exigeConfirmacao: dados.exigeConfirmacao,
        publico: dados.publico,
        memberIds: dados.memberIds,
        // Fim do dia escolhido, no fuso do navegador.
        fimEm: dados.fimEm
          ? new Date(`${dados.fimEm}T23:59:59`).toISOString()
          : null,
      },
      { onSuccess: () => form.reset(VAZIO) },
    );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="rounded-lg border p-4"
    >
      <FieldGroup>
        <Controller
          name="titulo"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Título</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="Ex.: Óleo com 5% extra até sexta"
              />
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="corpo"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Mensagem</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={4}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            name="prioridade"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Prioridade</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="IMPORTANTE">Importante</SelectItem>
                    <SelectItem value="URGENTE">
                      Urgente (trava a home)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            name="publico"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Para quem</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Toda a equipe</SelectItem>
                    <SelectItem value="MEMBROS">
                      Vendedores escolhidos
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            name="fimEm"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Fica no ar até</FieldLabel>
                <Input {...field} id={field.name} type="date" />
              </Field>
            )}
          />
        </div>
        {publico === "MEMBROS" ? (
          <Controller
            name="memberIds"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Vendedores</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {vendedores.map((vendedor) => (
                    <div
                      key={vendedor.memberId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`aviso-${vendedor.memberId}`}
                        checked={field.value.includes(vendedor.memberId)}
                        onCheckedChange={(marcado) =>
                          field.onChange(
                            marcado
                              ? [...field.value, vendedor.memberId]
                              : field.value.filter(
                                  (id) => id !== vendedor.memberId,
                                ),
                          )
                        }
                      />
                      <label htmlFor={`aviso-${vendedor.memberId}`}>
                        {vendedor.nome}
                      </label>
                    </div>
                  ))}
                </div>
                {fieldState.error ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />
        ) : null}
        <Controller
          name="link"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Link (opcional)</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="https://"
              />
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="exigeConfirmacao"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id={field.name}
                checked={field.value || prioridade === "URGENTE"}
                disabled={prioridade === "URGENTE"}
                onCheckedChange={field.onChange}
              />
              <FieldLabel htmlFor={field.name}>
                Pedir &quot;Li e entendi&quot;
              </FieldLabel>
              <FieldDescription>Urgente sempre pede.</FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="mt-4" disabled={publicar.isPending}>
        Publicar aviso
      </Button>
    </form>
  );
}

const PRIORIDADE: Record<string, string> = {
  NORMAL: "Normal",
  IMPORTANTE: "Importante",
  URGENTE: "Urgente",
};

export function GestaoDeAvisos() {
  const { data: avisos = [], isPending } = useAvisosGestao();
  const encerrar = useEncerrarAvisoGestao();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <NovoAviso />
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Publicados</h2>
        {isPending ? (
          <Skeleton className="h-40" />
        ) : avisos.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum aviso publicado.
          </p>
        ) : (
          avisos.map((aviso) => (
            <div
              key={aviso.id}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{aviso.titulo}</span>
                <Badge
                  variant={
                    aviso.prioridade === "URGENTE" ? "destructive" : "secondary"
                  }
                >
                  {PRIORIDADE[aviso.prioridade]}
                </Badge>
                {!aviso.vigente ? (
                  <Badge variant="outline">Fora do ar</Badge>
                ) : null}
              </div>
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {aviso.corpo}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatarDataHora(aviso.inicioEm)}
                {aviso.autor ? ` · ${aviso.autor}` : ""}
                {aviso.fimEm ? ` · até ${formatarDataHora(aviso.fimEm)}` : ""}
              </p>
              <p className="text-sm">
                {aviso.exigeConfirmacao ? "Confirmado" : "Lido"} por{" "}
                <strong className="tabular-nums">
                  {aviso.lidos} de {aviso.total}
                </strong>
                {aviso.pendentes.length > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · falta: {aviso.pendentes.join(", ")}
                  </span>
                ) : null}
              </p>
              {aviso.vigente ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={encerrar.isPending}
                  onClick={() => encerrar.mutate({ avisoId: aviso.id })}
                >
                  Tirar do ar
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
