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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const forgotSchema = z.object({
  email: z.email("E-mail inválido"),
});

type ForgotSchema = z.infer<typeof forgotSchema>;

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isSent, setIsSent] = useState(false);
  const form = useForm<ForgotSchema>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotSchema) => {
    await authClient.requestPasswordReset(
      { email: data.email, redirectTo: "/redefinir-senha" },
      {
        onSuccess: () => setIsSent(true),
        onError: () => {
          toast.error("Não foi possível solicitar a redefinição");
        },
      },
    );
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Esqueceu sua senha?</CardTitle>
          <CardDescription>
            Enviamos um link de redefinição para o seu e-mail
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSent ? (
            <FieldGroup>
              <FieldDescription className="text-center">
                Se este e-mail existir no sistema, o link de redefinição foi
                enviado. Verifique sua caixa de entrada.
              </FieldDescription>
              <FieldDescription className="text-center">
                <Link href="/login">Voltar ao login</Link>
              </FieldDescription>
            </FieldGroup>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
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
                  <Button type="submit" disabled={isSubmitting}>
                    Enviar link
                  </Button>
                  <FieldDescription className="text-center">
                    <Link href="/login">Voltar ao login</Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
