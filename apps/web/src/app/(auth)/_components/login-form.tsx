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
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function safeRedirect(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginSchema = z.infer<typeof loginSchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirectTo"));
  // Param cru (sem o default /dashboard) para repassar ao link de cadastro.
  const rawRedirect = searchParams.get("redirectTo");
  const signUpHref = rawRedirect
    ? `/cadastro?redirectTo=${encodeURIComponent(rawRedirect)}`
    : "/cadastro";
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const onLogin = async (data: LoginSchema) => {
    await authClient.signIn.email(
      {
        email: data.email,
        password: data.password,
      },
      {
        onSuccess: () => {
          toast.success("Login realizado com sucesso");
          router.push(redirectTo);
          // Invalida o Router Cache: o destino (ex.: /accept-invitation) é um
          // Server Component que lê a sessão; sem isto o Next reexibe a versão
          // deslogada em cache e o fluxo de convite trava.
          router.refresh();
        },
        onError: () => {
          toast.error("Erro ao realizar login");
        },
      },
    );
  };

  const onGoogleLogin = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
      // Um usuário novo do Google vindo de um convite deve voltar ao convite,
      // não cair na criação de organização. Usa o param cru (sem o default).
      newUserCallbackURL: rawRedirect ?? "/create-organization",
    });
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bem-vindo</CardTitle>
          <CardDescription>Login com sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onLogin)}>
            <FieldGroup>
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
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                ou
              </FieldSeparator>
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Senha</FieldLabel>
                  <Link
                    href="/esqueci-senha"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    Esqueceu sua senha?
                  </Link>
                </div>
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
                <Button type="submit">Login</Button>
                <FieldDescription className="text-center">
                  Não tem uma conta? <Link href={signUpHref}>Cadastrar</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Ao clicar em continuar, você concorda com nossos{" "}
        <a href="#">Termos de Serviço</a> e{" "}
        <a href="#">Política de Privacidade</a>.
      </FieldDescription>
    </div>
  );
}
