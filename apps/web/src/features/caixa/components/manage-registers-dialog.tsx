"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  useCashRegisters,
  useCreateRegister,
  useDeleteRegister,
  useUpdateRegister,
} from "../hooks/use-caixa";

const schema = z.object({
  name: z.string().min(1, "Informe o nome do caixa"),
});
type FormValues = z.infer<typeof schema>;

type Register = { id: string; name: string; isActive: boolean };

function RegisterRow({ register }: { register: Register }) {
  const [name, setName] = useState(register.name);
  const update = useUpdateRegister();
  const remove = useDeleteRegister();

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== register.name;

  return (
    <TableRow className={register.isActive ? undefined : "opacity-60"}>
      <TableCell>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={register.isActive}
          onCheckedChange={(isActive) =>
            update.mutate({ id: register.id, isActive })
          }
          disabled={update.isPending}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {dirty && (
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: register.id, name: trimmed })}
            >
              Salvar
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ id: register.id })}
            aria-label={`Excluir ${register.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ManageRegistersDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const { registers, isLoading } = useCashRegisters(includeInactive);
  const create = useCreateRegister();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: FormValues) => {
    create.mutate(
      { name: values.name.trim() },
      { onSuccess: () => reset({ name: "" }) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar caixas</DialogTitle>
          <DialogDescription>
            Cadastre os terminais de caixa físicos da loja (ex.: "Caixa 01").
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="register-name">Novo caixa</FieldLabel>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Controller
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <Input
                        id="register-name"
                        placeholder="Caixa 01"
                        {...field}
                      />
                    )}
                  />
                </div>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Adicionando…" : "Adicionar"}
                </Button>
              </div>
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
          </FieldGroup>
        </form>

        <div className="flex items-center gap-2">
          <Switch
            id="include-inactive"
            checked={includeInactive}
            onCheckedChange={setIncludeInactive}
          />
          <Label htmlFor="include-inactive" className="text-sm font-normal">
            Incluir inativos
          </Label>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : registers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum caixa cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registers.map((register) => (
                  <RegisterRow key={register.id} register={register} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
