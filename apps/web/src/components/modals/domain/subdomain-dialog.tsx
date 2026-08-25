"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowUpRightIcon, CheckCircle2, Edit2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { toast } from "sonner";
import Link from "next/link";

const DEFAULT_DOMAIN =
  process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

const RESERVED_SUBDOMAINS = [
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "ftp",
  "smtp",
  "pop",
  "imap",
  "blog",
  "store",
  "shop",
];

const subdomainSchema = z.object({
  subdomain: z
    .string()
    .min(3, "O subdomínio deve ter pelo menos 3 caracteres")
    .max(63, "O subdomínio deve ter no máximo 63 caracteres")
    .regex(
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
      "Use apenas letras minúsculas, números e hífens (não pode começar ou terminar com hífen)",
    )
    .refine(
      (value) => !RESERVED_SUBDOMAINS.includes(value),
      "Este subdomínio está reservado",
    )
    .transform((value) => value.toLowerCase()),
});

type SubdomainFormValues = z.infer<typeof subdomainSchema>;

export function SubdomainDialog() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(orpc.org.get.queryOptions());
  const [isOpen, setIsOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const url = new URL(DEFAULT_DOMAIN);

  const form = useForm<SubdomainFormValues>({
    resolver: zodResolver(subdomainSchema),
    defaultValues: {
      subdomain: data?.organization.subdomain || "",
    },
  });

  const subdomainValue = form.watch("subdomain");

  const CUSTOM_DOMAIN = `${url.protocol}//${
    data?.organization.subdomain
  }.${url.host}`;

  const EDIT_DOMAIN = `${url.protocol}//${subdomainValue || "subdomain"}.${
    url.host
  }`;

  // Mutation para verificar disponibilidade
  const checkSubdomainMutation = useMutation(
    orpc.org.checkSubdomain.mutationOptions({
      onSuccess: (response) => {
        if (response.available) {
          console.log("Available: ", response.available);
          setIsAvailable(true);
          toast.success(
            "Subdomínio disponível! Clique em Salvar para confirmar.",
          );
        } else {
          setIsAvailable(false);
          form.setError("subdomain", {
            type: "manual",
            message: response.message || "Este subdomínio não está disponível",
          });
        }
      },
      onError: (error: any) => {
        setIsAvailable(false);
        toast.error(error.message || "Erro ao verificar subdomínio");
      },
    }),
  );

  // Mutation para salvar o subdomínio
  const updateSubdomainMutation = useMutation(
    orpc.org.updateSubdomain.mutationOptions({
      onSuccess: (response) => {
        queryClient.invalidateQueries({
          queryKey: orpc.org.get.key(),
        });
        toast.success("Subdomínio atualizado com sucesso!");
        setIsOpen(false);
        setIsAvailable(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Erro ao atualizar subdomínio");
      },
    }),
  );
  const handleCancel = () => {
    if (data?.organization.subdomain) {
      form.reset({ subdomain: data.organization.subdomain });
    }
    form.clearErrors();
    setIsOpen(false);
    setIsAvailable(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      handleCancel();
    }
  };

  const onSubmit = async (formData: SubdomainFormValues) => {
    // Se já verificou e está disponível, salva
    if (isAvailable) {
      updateSubdomainMutation.mutate({
        subdomain: formData.subdomain,
      });
      return;
    }

    // Caso contrário, verifica disponibilidade
    checkSubdomainMutation.mutate({
      subdomain: formData.subdomain,
    });
  };

  // Sincroniza o valor inicial quando os dados carregam
  useEffect(() => {
    if (data?.organization.subdomain) {
      form.reset({ subdomain: data.organization.subdomain });
    }
  }, [data, form]);

  // Reseta o estado de disponibilidade quando o usuário muda o subdomínio
  //   useEffect(() => {
  //     if (
  //       isAvailable &&
  //       subdomainValue !== form.formState.defaultValues?.subdomain
  //     ) {
  //       setIsAvailable(false);
  //     }
  //   }, [subdomainValue, isAvailable, form.formState.defaultValues]);

  const hasChanges = subdomainValue !== data?.organization.subdomain;
  const isFormValid = form.formState.isValid && subdomainValue.length >= 3;
  const isLoading = checkSubdomainMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <div className="flex items-center gap-2">
        <DialogTrigger asChild>
          {isPending ? (
            <Skeleton className="h-10 w-77.5" />
          ) : (
            <Button
              variant="secondary"
              disabled={!data?.organization.subdomain}
            >
              {CUSTOM_DOMAIN} <Edit2 className="size-4" />
            </Button>
          )}
        </DialogTrigger>
        <Button variant="secondary" size="icon" asChild>
          <Link href={EDIT_DOMAIN} target="_blank">
            <ArrowUpRightIcon className="size-4" />
          </Link>
        </Button>
      </div>

      <DialogContent showCloseButton={false} className="sm:max-w-xl">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              Alterar endereço (URL) do site do seu catálogo
            </DialogTitle>
            <DialogDescription>
              Este é o endereço atual do site do seu catálogo:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div className="flex flex-col items-center justify-center">
              <div
                className={cn(
                  buttonVariants({
                    variant: "secondary",
                  }),
                  "mx-auto pointer-events-none",
                )}
              >
                <span className="text-sm font-semibold text-foreground">
                  {EDIT_DOMAIN}
                </span>
              </div>
            </div>

            <Controller
              name="subdomain"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="subdomain">
                    Insira o novo subdomínio aqui:
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      placeholder="meusite"
                      id="subdomain"
                      aria-invalid={fieldState.invalid}
                      disabled={isLoading}
                      onChange={(e) => {
                        const value = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "");
                        field.onChange(value);
                        // Limpa erro ao digitar
                        if (fieldState.error) {
                          form.clearErrors("subdomain");
                        }
                      }}
                      className={cn(
                        fieldState.error &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                    {isAvailable && hasChanges && (
                      <CheckCircle2 className="absolute right-3 top-3 size-4 text-green-600" />
                    )}
                  </div>
                  <FieldDescription>
                    Use apenas letras minúsculas, números e hífens. Mínimo 3
                    caracteres.
                  </FieldDescription>
                  {fieldState.error && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              </DialogClose>

              {isAvailable ? (
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {/* {updateSubdomainMutation.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )} */}
                  Salvar
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!isFormValid || !hasChanges || isLoading}
                >
                  {checkSubdomainMutation.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Verificar disponibilidade
                </Button>
              )}
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
