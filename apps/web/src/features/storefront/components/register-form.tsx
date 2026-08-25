"use client";

import { cn } from "@/lib/utils";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/context/catalog/use-cart-session";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { formatCPForCNPJ } from "@/utils/format-cnpj";

const signUpSchema = z
  .object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.email("E-mail inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z
      .string()
      .min(6, "Senha deve ter pelo menos 6 caracteres"),
    document: z
      .string()
      .min(11, "CPF ou CNPJ deve ter pelo menos 11 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type SignUpSchema = z.infer<typeof signUpSchema>;

interface RegisterFormProps {
  subdomain?: string;
}

export function RegisterFormCatalog({
  className,
  subdomain,
  ...props
}: React.ComponentProps<"div"> & RegisterFormProps) {
  const router = useRouter();
  const { signIn } = useUserStore();
  const signInHref = useCatalogHref("/sign-in");
  const form = useForm<SignUpSchema>({
    resolver: zodResolver(signUpSchema),
  });

  const signUpMutation = useMutation(
    orpc.catalogSettings.signupCatalog.mutationOptions({
      onSuccess: (data) => {
        toast.success("Conta criada com sucesso");
        signIn({
          user: {
            id: data.userWithoutPassword.id,
            email: data.userWithoutPassword.email,
            name: data.userWithoutPassword.name,
            type: "customer",
          },
        });
        router.push("/");
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao realizar login");
      },
    })
  );

  const onSignUp = async (data: SignUpSchema) => {
    if (!subdomain) {
      toast.error("Erro de servidor");
      return;
    }
    signUpMutation.mutate({
      email: data.email,
      password: data.password,
      document: data.document,
      name: data.name,
      subdomain,
    });
  };

  const isSubmitting = signUpMutation.isPending;

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Crie sua conta</CardTitle>
            <CardDescription>
              Insira seu e-mail abaixo para continuar sua sessão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSignUp)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Nome</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    disabled={isSubmitting}
                    {...form.register("name")}
                  />
                  <FieldError>{form.formState.errors.name?.message}</FieldError>
                </Field>
                <Controller
                  name="document"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>CPF/CNPJ</FieldLabel>
                      <Input
                        disabled={isSubmitting}
                        placeholder="000.000.000-00"
                        value={formatCPForCNPJ(field.value ?? "")}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                      <FieldError>
                        {form.formState.errors.document?.message}
                      </FieldError>
                    </Field>
                  )}
                />
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="johndoe@example.com"
                    disabled={isSubmitting}
                    {...form.register("email")}
                  />
                  <FieldError>
                    {form.formState.errors.email?.message}
                  </FieldError>
                </Field>
                <Field>
                  <Field className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="password">Senha</FieldLabel>
                      <Input
                        id="password"
                        type="password"
                        placeholder="********"
                        disabled={isSubmitting}
                        {...form.register("password")}
                      />
                      <FieldError>
                        {form.formState.errors.password?.message}
                      </FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="confirm-password">
                        Confirmar Senha
                      </FieldLabel>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="********"
                        disabled={isSubmitting}
                        {...form.register("confirmPassword")}
                      />
                      <FieldError>
                        {form.formState.errors.confirmPassword?.message}
                      </FieldError>
                    </Field>
                  </Field>
                  <FieldDescription>
                    Deve ter pelo menos 8 caracteres.
                  </FieldDescription>
                </Field>
                <Field>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Criar Conta
                  </Button>
                </Field>
                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  ou
                </FieldSeparator>
                <Field>
                  <FieldDescription className="text-center">
                    Já tem uma conta? <Link href={signInHref}>Entrar</Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <FieldDescription className="px-6 text-center">
          Ao clicar em continuar, você concorda com nossos{" "}
          <Link href="#">Termos de Serviço</Link> e{" "}
          <Link href="#">Política de Privacidade</Link>.
        </FieldDescription>
      </div>
    </div>
  );
}
