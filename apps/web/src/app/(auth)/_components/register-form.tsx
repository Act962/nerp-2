"use client";

import { cn } from "@/lib/utils";
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
import { authClient } from "@/lib/auth-client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/context/catalog/use-cart-session";

function safeRedirect(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

const signUpSchema = z
  .object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
    email: z.email("E-mail inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z
      .string()
      .min(6, "Senha deve ter pelo menos 6 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type SignUpSchema = z.infer<typeof signUpSchema>;

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirectTo"));
  const successPath = redirectTo ?? "/create-organization";
  const form = useForm<SignUpSchema>({
    resolver: zodResolver(signUpSchema),
  });
  const { signIn } = useUserStore();

  const onSignUp = async (data: SignUpSchema) => {
    await authClient.signUp.email(
      {
        email: data.email,
        password: data.password,
        name: data.name,
      },
      {
        onSuccess: () => {
          toast.success("Conta criada com sucesso");
          router.push(successPath);
          // Invalida o Router Cache para o destino (ex.: /accept-invitation)
          // rerenderizar já com a sessão nova, senão o fluxo de convite reexibe
          // a tela deslogada em cache.
          router.refresh();
        },
        onError: () => {
          toast.error("Erro ao criar conta");
        },
      },
    );
  };

  const onGoogleLogin = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: successPath,
      // Quando veio de um QR de garçom (redirectTo), o novo usuário Google deve
      // cair na área do garçom — não na criação de org.
      newUserCallbackURL: redirectTo ?? "/create-organization",
    });
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Crie sua conta</CardTitle>
          <CardDescription>
            Insira seu e-mail abaixo para criar sua conta
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
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="johndoe@example.com"
                  disabled={isSubmitting}
                  {...form.register("email")}
                />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
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
                <Button
                  onClick={onGoogleLogin}
                  variant="outline"
                  type="button"
                  disabled={isSubmitting}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Entrar com Google
                </Button>
                <FieldDescription className="text-center">
                  Já tem uma conta?{" "}
                  <Link
                    href={
                      redirectTo
                        ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
                        : "/login"
                    }
                  >
                    Entrar
                  </Link>
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
  );
}
