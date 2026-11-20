"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, type UseFormReturn, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useCondicoesGestao,
  useConfiguracaoGestao,
  useSalvarCondicaoGestao,
  useSalvarConfiguracaoGestao,
} from "../../hooks/use-gestao-fv";
import { descreverPrazos } from "../../lib/parcelas";
import { lerDecimal } from "../../lib/posicao";

const numero = (mensagem: string) =>
  z.string().refine((valor) => lerDecimal(valor) !== null, mensagem);

const politicaSchema = z.object({
  descontoLivrePercent: numero("Informe o desconto livre"),
  descontoMaximoPercent: numero("Informe o desconto máximo"),
  flexCreditoPercent: numero("Informe o crédito do flex"),
  flexLimiteNegativo: numero("Informe o limite negativo"),
  autoAprovar: z.boolean(),
  bloquearInadimplente: z.boolean(),
  raioCheckinMetros: numero("Informe o raio"),
  retencaoLocalizacaoDias: numero("Informe a retenção"),
  destinoPedido: z.enum(["NATIVO", "WINTHOR"]),
});

type Politica = z.infer<typeof politicaSchema>;
type Configuracao = NonNullable<
  ReturnType<typeof useConfiguracaoGestao>["data"]
>;

const texto = (valor: number) => String(valor).replace(".", ",");

function CampoNumero({
  form,
  nome,
  rotulo,
  descricao,
}: {
  form: UseFormReturn<Politica>;
  nome:
    | "descontoLivrePercent"
    | "descontoMaximoPercent"
    | "flexCreditoPercent"
    | "flexLimiteNegativo"
    | "raioCheckinMetros"
    | "retencaoLocalizacaoDias";
  rotulo: string;
  descricao: string;
}) {
  return (
    <Controller
      name={nome}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field>
          <FieldLabel htmlFor={field.name}>{rotulo}</FieldLabel>
          <Input
            {...field}
            id={field.name}
            inputMode="decimal"
            aria-invalid={fieldState.invalid}
          />
          <FieldDescription>{descricao}</FieldDescription>
          {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

function FormularioDePolitica({ config }: { config: Configuracao }) {
  const salvar = useSalvarConfiguracaoGestao();
  const form = useForm<Politica>({
    resolver: zodResolver(politicaSchema),
    defaultValues: {
      descontoLivrePercent: texto(config.descontoLivrePercent),
      descontoMaximoPercent: texto(config.descontoMaximoPercent),
      flexCreditoPercent: texto(config.flexCreditoPercent),
      flexLimiteNegativo: texto(config.flexLimiteNegativo),
      autoAprovar: config.autoAprovar,
      bloquearInadimplente: config.bloquearInadimplente,
      raioCheckinMetros: String(config.raioCheckinMetros),
      retencaoLocalizacaoDias: String(config.retencaoLocalizacaoDias),
      destinoPedido: config.destinoPedido,
    },
  });
  const onSubmit = (dados: Politica) =>
    salvar.mutate({
      descontoLivrePercent: lerDecimal(dados.descontoLivrePercent) ?? 0,
      descontoMaximoPercent: lerDecimal(dados.descontoMaximoPercent) ?? 0,
      flexCreditoPercent: lerDecimal(dados.flexCreditoPercent) ?? 0,
      flexLimiteNegativo: lerDecimal(dados.flexLimiteNegativo) ?? 0,
      autoAprovar: dados.autoAprovar,
      bloquearInadimplente: dados.bloquearInadimplente,
      raioCheckinMetros: Math.round(lerDecimal(dados.raioCheckinMetros) ?? 300),
      retencaoLocalizacaoDias: Math.round(
        lerDecimal(dados.retencaoLocalizacaoDias) ?? 90,
      ),
      destinoPedido: dados.destinoPedido,
    });

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="rounded-lg border p-4"
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero
            form={form}
            nome="descontoLivrePercent"
            rotulo="Desconto livre (%)"
            descricao="Dado sem mexer no saldo flex."
          />
          <CampoNumero
            form={form}
            nome="descontoMaximoPercent"
            rotulo="Desconto máximo (%)"
            descricao="Acima disso, o pedido vai para aprovação."
          />
          <CampoNumero
            form={form}
            nome="flexCreditoPercent"
            rotulo="Crédito do flex (%)"
            descricao="Parte do valor vendido acima da tabela que vira saldo."
          />
          <CampoNumero
            form={form}
            nome="flexLimiteNegativo"
            rotulo="Flex pode ficar negativo até (R$)"
            descricao="Abaixo disso, o pedido vai para aprovação."
          />
          <CampoNumero
            form={form}
            nome="raioCheckinMetros"
            rotulo="Raio do check-in (m)"
            descricao="Mais longe que isso do cliente pede justificativa."
          />
          <CampoNumero
            form={form}
            nome="retencaoLocalizacaoDias"
            rotulo="Guardar localização por (dias)"
            descricao="Depois disso os pontos da jornada são apagados."
          />
        </div>
        <Controller
          name="autoAprovar"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              <FieldLabel htmlFor={field.name}>
                Pedido dentro da política entra aprovado
              </FieldLabel>
            </Field>
          )}
        />
        <Controller
          name="bloquearInadimplente"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              <FieldLabel htmlFor={field.name}>
                Cliente com título vencido vai para aprovação
              </FieldLabel>
            </Field>
          )}
        />
        <Controller
          name="destinoPedido"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                Para onde vai o pedido aprovado
              </FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} className="sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NATIVO">
                    NERP (receptor próprio)
                  </SelectItem>
                  <SelectItem value="WINTHOR" disabled>
                    Winthor (em breve, pela integração)
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="mt-4" disabled={salvar.isPending}>
        Salvar política
      </Button>
    </form>
  );
}

const condicaoSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome à condição").max(60),
  prazos: z
    .string()
    .trim()
    .regex(
      /^\d{1,3}(\s*[/,;\s]\s*\d{1,3})*$/,
      "Use números separados por barra, ex.: 28/35/42",
    ),
  formaPagamento: z.enum([
    "DINHEIRO",
    "PIX",
    "DEBITO",
    "CREDITO",
    "BOLETO",
    "TRANSFERENCIA",
    "OUTROS",
  ]),
  ativo: z.boolean(),
});

type Condicao = z.infer<typeof condicaoSchema>;

const FORMAS: Record<Condicao["formaPagamento"], string> = {
  BOLETO: "Boleto",
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência",
  CREDITO: "Cartão de crédito",
  DEBITO: "Cartão de débito",
  OUTROS: "Outros",
};

function FormularioDeCondicao({
  inicial,
  onFechar,
}: {
  inicial: (Condicao & { id: string | null }) | null;
  onFechar: () => void;
}) {
  const salvar = useSalvarCondicaoGestao();
  const form = useForm<Condicao>({
    resolver: zodResolver(condicaoSchema),
    defaultValues: inicial ?? {
      nome: "",
      prazos: "0",
      formaPagamento: "BOLETO",
      ativo: true,
    },
  });
  const onSubmit = (dados: Condicao) =>
    salvar.mutate(
      {
        id: inicial?.id ?? null,
        nome: dados.nome,
        prazosDias: dados.prazos
          .split(/[/,;\s]+/)
          .filter(Boolean)
          .map(Number),
        formaPagamento: dados.formaPagamento,
        ativo: dados.ativo,
      },
      { onSuccess: onFechar },
    );
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="nome"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="Ex.: Boleto 28/35/42"
              />
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="prazos"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Prazos em dias</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="0 para à vista"
              />
              <FieldDescription>
                Um número por parcela, contado do faturamento.
              </FieldDescription>
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="formaPagamento"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Forma de pagamento</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAS).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name="ativo"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              <FieldLabel htmlFor={field.name}>
                Disponível para os vendedores
              </FieldLabel>
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter className="mt-4">
        <Button type="submit" disabled={salvar.isPending}>
          Salvar condição
        </Button>
      </DialogFooter>
    </form>
  );
}

function CondicoesDePagamento() {
  const { data: condicoes = [], isPending } = useCondicoesGestao();
  const [editando, setEditando] = useState<
    (Condicao & { id: string | null }) | null
  >(null);
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Condições de pagamento</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditando(null);
            setAberto(true);
          }}
        >
          Nova condição
        </Button>
      </div>
      {isPending ? (
        <Skeleton className="h-24" />
      ) : condicoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem condição cadastrada o pedido fatura à vista, em boleto.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {condicoes.map((condicao) => (
            <li
              key={condicao.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{condicao.nome}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {descreverPrazos(condicao.prazosDias)} ·{" "}
                  {FORMAS[condicao.formaPagamento]}
                </span>
                {!condicao.ativo ? (
                  <Badge variant="outline" className="ml-2">
                    Inativa
                  </Badge>
                ) : null}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditando({
                    id: condicao.id,
                    nome: condicao.nome,
                    prazos: condicao.prazosDias.join("/"),
                    formaPagamento: condicao.formaPagamento,
                    ativo: condicao.ativo,
                  });
                  setAberto(true);
                }}
              >
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar condição" : "Nova condição"}
            </DialogTitle>
          </DialogHeader>
          {aberto ? (
            <FormularioDeCondicao
              key={editando?.id ?? "nova"}
              inicial={editando}
              onFechar={() => setAberto(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PoliticaComercial() {
  const { data: config, isPending } = useConfiguracaoGestao();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {isPending || !config ? (
        <Skeleton className="h-96" />
      ) : (
        <FormularioDePolitica config={config} />
      )}
      <CondicoesDePagamento />
    </div>
  );
}
