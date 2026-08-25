"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  useAcceptJoinLink,
  useJoinLinkPreview,
} from "@/features/invitations/hooks/use-join-link";
import { constructUrl } from "@/hooks/use-construct-url";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Página de entrada por link aberto.
 *
 * Sem conta ainda? Manda para login/cadastro com `?redirectTo` de volta para
 * cá — o mesmo mecanismo do convite nominal, para a pessoa não cair no fluxo
 * de "criar organização" depois de se cadastrar.
 */
export function JoinLinkCard({ token }: { token: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useJoinLinkPreview(token);
  const accept = useAcceptJoinLink();
  const { data: session, isPending: loadingSession } = authClient.useSession();

  const joinPath = `/entrar/${token}`;

  if (isLoading || loadingSession) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="size-5" /> Link inválido
          </CardTitle>
          <CardDescription>
            Este link de convite não existe mais, expirou ou foi desativado pelo
            administrador da empresa.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <Avatar className="size-14">
          {data.organizationLogo && (
            <AvatarImage src={constructUrl(data.organizationLogo)} alt="" />
          )}
          <AvatarFallback>
            <Building2 className="size-6" />
          </AvatarFallback>
        </Avatar>
        <CardTitle className="mt-2">{data.organizationName}</CardTitle>
        <CardDescription>
          Você foi convidado a fazer parte desta empresa.
        </CardDescription>
      </CardHeader>

      {!session ? (
        <>
          <CardContent className="text-center text-sm text-muted-foreground">
            Entre com sua conta ou cadastre-se para continuar.
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link
                href={`/cadastro?redirectTo=${encodeURIComponent(joinPath)}`}
              >
                Criar conta
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/login?redirectTo=${encodeURIComponent(joinPath)}`}>
                Já tenho conta
              </Link>
            </Button>
          </CardFooter>
        </>
      ) : (
        <CardFooter>
          <Button
            className="w-full gap-2"
            disabled={accept.isPending}
            onClick={() =>
              accept.mutate(
                { token },
                {
                  onSuccess: () => {
                    // Mesma razão do convite nominal: entrar troca a org
                    // ativa, e sem limpar o cache o dashboard abriria com
                    // dados da org anterior.
                    queryClient.clear();
                    router.push("/dashboard");
                    router.refresh();
                  },
                },
              )
            }
          >
            {accept.isPending && <Spinner />}
            Entrar na empresa
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
