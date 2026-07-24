"use client";

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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// maxPasswordLength do better-auth (src/lib/auth.ts) é 20; validar aqui evita
// o usuário só descobrir o limite depois de submeter.
const resetSchema = z
  .object({
    password: z
      .string()
      .min(6, "Senha deve ter pelo menos 6 caracteres")
      .max(20, "Senha deve ter no máximo 20 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type ResetSchema = z.infer<typeof resetSchema>;

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const form = useForm<ResetSchema>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (data: ResetSchema) => {
    if (!token) return;
    await authClient.resetPassword(
      { newPassword: data.password, token },
      {
        onSuccess: () => {
          toast.success("Senha redefinida. Faça login com a nova senha.");
          router.push("/login");
        },
        onError: (context) => {
          toast.error(
            context.error.message ??
              "Não foi possível redefinir a senha. O link pode ter expirado.",
          );
        },
      },
    );
  };

  const isSubmitting = form.formState.isSubmitting;

  if (!token) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Link inválido</CardTitle>
            <CardDescription>
              Este link de redefinição está incompleto ou expirou.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldDescription className="text-center">
              <Link href="/esqueci-senha">Pedir um novo link</Link>
            </FieldDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Nova senha</CardTitle>
          <CardDescription>Escolha a senha que você vai usar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">Nova senha</FieldLabel>
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
                <FieldLabel htmlFor="confirmPassword">
                  Confirmar senha
                </FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="********"
                  disabled={isSubmitting}
                  {...form.register("confirmPassword")}
                />
                <FieldError>
                  {form.formState.errors.confirmPassword?.message}
                </FieldError>
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  Redefinir senha
                </Button>
                <FieldDescription className="text-center">
                  <Link href="/login">Voltar ao login</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
