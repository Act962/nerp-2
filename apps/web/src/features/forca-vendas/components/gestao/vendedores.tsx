"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tradeRoleLabel } from "@/lib/permissions";
import {
  useAjustarFlexGestao,
  useAtualizarVendedorGestao,
  useExtratoFlexGestao,
  useVendedoresGestao,
} from "../../hooks/use-gestao-fv";
import { formatarDataHora, formatBRL } from "../../lib/formatar";
import { lerDecimal } from "../../lib/posicao";

type Vendedor = NonNullable<
  ReturnType<typeof useVendedoresGestao>["data"]
>[number];

// Campos numéricos ficam como texto no formulário ("7,5") e viram número no envio.
const decimalOpcional = z
  .string()
  .refine(
    (valor) => !valor.trim() || lerDecimal(valor) !== null,
    "Número inválido",
  );

const perfilSchema = z.object({
  ativo: z.boolean(),
  codigo: z.string().max(40),
  descontoMaximoPercent: decimalOpcional,
  flexLimiteNegativo: decimalOpcional,
});

function EditarVendedor({
  vendedor,
  onFechar,
}: {
  vendedor: Vendedor;
  onFechar: () => void;
}) {
  const atualizar = useAtualizarVendedorGestao();
  const form = useForm<z.infer<typeof perfilSchema>>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      ativo: vendedor.ativo,
      codigo: vendedor.codigo ?? "",
      descontoMaximoPercent:
        vendedor.descontoMaximoPercent === null
          ? ""
          : String(vendedor.descontoMaximoPercent).replace(".", ","),
      flexLimiteNegativo:
        vendedor.flexLimiteNegativo === null
          ? ""
          : String(vendedor.flexLimiteNegativo).replace(".", ","),
    },
  });

  const onSubmit = (dados: z.infer<typeof perfilSchema>) =>
    atualizar.mutate(
      {
        memberId: vendedor.memberId,
        ativo: dados.ativo,
        codigo: dados.codigo || null,
        descontoMaximoPercent: lerDecimal(dados.descontoMaximoPercent),
        flexLimiteNegativo: lerDecimal(dados.flexLimiteNegativo),
      },
      { onSuccess: onFechar },
    );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
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
                Acesso ao app liberado
              </FieldLabel>
            </Field>
          )}
        />
        <Controller
          name="codigo"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Código no ERP</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="Ex.: 12 (CODUSUR)"
              />
              <FieldDescription>
                Usado quando o pedido for enviado a um ERP externo.
              </FieldDescription>
            </Field>
          )}
        />
        <Controller
          name="descontoMaximoPercent"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Desconto máximo (%)</FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="decimal"
                aria-invalid={fieldState.invalid}
                placeholder="Vazio = política da empresa"
              />
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="flexLimiteNegativo"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                Quanto o flex pode ficar negativo (R$)
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="decimal"
                aria-invalid={fieldState.invalid}
                placeholder="Vazio = política da empresa"
              />
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter className="mt-4">
        <Button type="submit" disabled={atualizar.isPending}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

const ajusteSchema = z.object({
  valor: z.string().refine((valor) => {
    const numero = lerDecimal(valor);
    return numero !== null && numero !== 0;
  }, "Informe um valor diferente de zero (negativo debita)"),
  descricao: z.string().trim().min(3, "Explique o ajuste"),
});

function AjustarFlex({
  vendedor,
  onFechar,
}: {
  vendedor: Vendedor;
  onFechar: () => void;
}) {
  const ajustar = useAjustarFlexGestao();
  const { data: extrato } = useExtratoFlexGestao(vendedor.memberId);
  const form = useForm<z.infer<typeof ajusteSchema>>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: { valor: "", descricao: "" },
  });
  const onSubmit = (dados: z.infer<typeof ajusteSchema>) =>
    ajustar.mutate(
      {
        memberId: vendedor.memberId,
        valor: lerDecimal(dados.valor) ?? 0,
        descricao: dados.descricao,
      },
      { onSuccess: onFechar },
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Saldo atual:{" "}
        <strong className="tabular-nums">
          {formatBRL(vendedor.saldoFlex)}
        </strong>
      </p>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="valor"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Valor (R$)</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  aria-invalid={fieldState.invalid}
                  placeholder="Ex.: 150,00 ou -50,00"
                />
                {fieldState.error ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />
          <Controller
            name="descricao"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Motivo</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  placeholder="Ex.: Bônus da campanha de óleo"
                />
                {fieldState.error ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />
        </FieldGroup>
        <DialogFooter className="mt-4">
          <Button type="submit" disabled={ajustar.isPending}>
            Lançar ajuste
          </Button>
        </DialogFooter>
      </form>
      {extrato && extrato.lancamentos.length > 0 ? (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-sm">
          {extrato.lancamentos.map((lancamento) => (
            <li key={lancamento.id} className="flex justify-between gap-2 p-2">
              <span className="min-w-0 truncate">
                {lancamento.descricao}
                <span className="text-muted-foreground">
                  {" "}
                  · {formatarDataHora(lancamento.data)}
                </span>
              </span>
              <span
                className={
                  lancamento.valor < 0
                    ? "text-destructive tabular-nums"
                    : "text-emerald-600 tabular-nums"
                }
              >
                {formatBRL(lancamento.valor)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function GestaoDeVendedores() {
  const { data: vendedores = [], isPending } = useVendedoresGestao();
  const [editando, setEditando] = useState<Vendedor | null>(null);
  const [ajustando, setAjustando] = useState<Vendedor | null>(null);

  if (isPending) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Aparece aqui quem tem a permissão &quot;App Força de Vendas&quot; ou o
        cargo Vendedor(a). Limites em branco seguem a política comercial da
        empresa.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead className="text-right">Clientes</TableHead>
              <TableHead className="text-right">Desconto máx.</TableHead>
              <TableHead className="text-right">Saldo flex</TableHead>
              <TableHead>Última posição</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedores.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  Nenhum vendedor ainda.
                </TableCell>
              </TableRow>
            ) : (
              vendedores.map((vendedor) => (
                <TableRow key={vendedor.memberId}>
                  <TableCell>
                    <span className="font-medium">{vendedor.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {tradeRoleLabel(vendedor.cargo) ?? vendedor.email}
                    </span>
                    {!vendedor.ativo ? (
                      <Badge variant="destructive">Sem acesso</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{vendedor.supervisor ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {vendedor.clientes}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {vendedor.descontoMaximoPercent === null
                      ? "Padrão"
                      : `${vendedor.descontoMaximoPercent}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(vendedor.saldoFlex)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendedor.ultimaPosicao
                      ? `${formatarDataHora(vendedor.ultimaPosicao.em)}${vendedor.ultimaPosicao.bateria != null ? ` · ${vendedor.ultimaPosicao.bateria}%` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAjustando(vendedor)}
                      >
                        Flex
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditando(vendedor)}
                      >
                        Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(editando)}
        onOpenChange={(open) => !open && setEditando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando?.nome}</DialogTitle>
            <DialogDescription>
              Acesso e limites próprios deste vendedor.
            </DialogDescription>
          </DialogHeader>
          {editando ? (
            <EditarVendedor
              key={editando.memberId}
              vendedor={editando}
              onFechar={() => setEditando(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(ajustando)}
        onOpenChange={(open) => !open && setAjustando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flex de {ajustando?.nome}</DialogTitle>
            <DialogDescription>
              Crédito ou débito manual, com registro no extrato.
            </DialogDescription>
          </DialogHeader>
          {ajustando ? (
            <AjustarFlex
              key={ajustando.memberId}
              vendedor={ajustando}
              onFechar={() => setAjustando(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
