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
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/context/catalog/use-cart-session";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

interface LoginFormProps {
  subdomain?: string;
}

type LoginSchema = z.infer<typeof loginSchema>;

export function LoginFormCatalog({
  className,
  subdomain,
  ...props
}: React.ComponentProps<"div"> & LoginFormProps) {
  const router = useRouter();
  const { signIn } = useUserStore();
  const signUpHref = useCatalogHref("/sign-up");

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation(
    orpc.catalogSettings.loginCatalog.mutationOptions({
      onSuccess: (data) => {
        // Login de catálogo
        signIn({
          user: {
            id: data.userWithoutPassword.id,
            email: data.userWithoutPassword.email,
            name: data.userWithoutPassword.name ?? "",
            type: "customer",
          },
        });

        router.push("/");
        return;
      },
      onError: (error) => {
        console.error("Erro ao logar:", error);
        toast.error(error.message || "Erro ao realizar login");
      },
    })
  );

  const onLogin = (data: LoginSchema) => {
    if (!subdomain) {
      toast.error("Erro de servidor");
      return;
    }
    loginMutation.mutate({
      email: data.email,
      password: data.password,
      subdomain,
    });
  };

  const isSubmitting = loginMutation.isPending;

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Bem-vindo</CardTitle>
            <CardDescription>Login com sua conta</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onLogin)}>
              <FieldGroup>
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
                  <FieldError>
                    {form.formState.errors.email?.message}
                  </FieldError>
                </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Senha</FieldLabel>
                    <a
                      href="#"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Esqueceu sua senha?
                    </a>
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
    </div>
  );
}
