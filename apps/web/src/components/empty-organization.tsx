"use client";

import { Building, CircleAlert, LogOut } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { Button, buttonVariants } from "./ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";

/**
 * Tela de quem entrou e não pertence a nenhuma organização.
 *
 * Depois do login automático na primeira organização (`auth-utils.ts`), quem
 * TEM organização nunca chega aqui — então esta tela significa exatamente uma
 * coisa: a conta está vazia. Na prática é quase sempre o lojista que já usava o
 * sistema e criou uma segunda conta sem querer; ele então abria chamado dizendo
 * que os dados tinham sumido.
 *
 * Daí o desenho: o e-mail em destaque é a pista que faz ele perceber a troca, e
 * a ação principal é SAIR, não criar outra organização — que era justamente o
 * caminho que gerava o chamado seguinte. Criar continua acessível, discreto,
 * para o cliente novo de verdade.
 */
export function EmptyOrganization({ email }: { email?: string | null }) {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onRequest: () => {
          router.push("/login");
        },
      },
    });
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building />
          </EmptyMedia>
          <EmptyTitle>
            Esta conta não faz parte de nenhuma organização
          </EmptyTitle>
          {email ? (
            <EmptyDescription>
              Você entrou como{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </EmptyDescription>
          ) : (
            <EmptyDescription>
              Nenhuma organização está vinculada a esta conta.
            </EmptyDescription>
          )}
        </EmptyHeader>

        <EmptyContent>
          <div className="flex w-full max-w-sm items-start gap-2 rounded-lg border bg-muted p-3 text-left text-sm text-muted-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p>
              <span className="font-semibold text-foreground">
                Já usava o sistema?
              </span>{" "}
              Seus dados não foram perdidos — eles continuam na conta de antes.
              Isso acontece quando uma conta nova é criada sem querer. Saia e
              entre com o e-mail de sempre.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button onClick={handleLogout}>
              <LogOut className="size-4" />
              Sair e entrar com outro e-mail
            </Button>
            <Link
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              href="/create-organization"
            >
              Criar uma organização
            </Link>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
