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
  useAcceptInvitation,
  useInvitation,
  useRejectInvitation,
} from "@/features/invitations/hooks/use-invitations";
import { authClient } from "@/lib/auth-client";
import { roleLabel } from "@/lib/permissions";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, MailX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AcceptInvitationCardProps {
  invitationId: string;
  // Sessão vista pelo servidor no primeiro render; usada só como valor inicial.
  currentUserEmail: string | null;
}

function InvitationShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailX className="size-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children && <CardFooter>{children}</CardFooter>}
    </Card>
  );
}

const STATUS_MESSAGES: Record<string, string> = {
  accepted: "Este convite já foi aceito.",
  rejected: "Este convite foi recusado.",
  canceled: "Este convite foi cancelado por um administrador.",
};

export function AcceptInvitationCard({
  invitationId,
  currentUserEmail,
}: AcceptInvitationCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { invitation, isLoading } = useInvitation(invitationId);
  const acceptInvitation = useAcceptInvitation();
  const rejectInvitation = useRejectInvitation();

  // Fonte da verdade da sessão é o cliente: ao voltar do login o Router Cache
  // pode reexibir o render deslogado do servidor, mas useSession refaz a busca
  // a cada montagem e reflete o login novo. A prop do servidor é só o inicial.
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const sessionEmail = session?.user?.email ?? null;
  // Enquanto a sessão do cliente carrega, confia no que o servidor mandou.
  const activeEmail = sessionPending ? currentUserEmail : sessionEmail;

  // Se o servidor não viu sessão (pode ser cache velho pós-login), espera a
  // sessão do cliente resolver antes de decidir — evita piscar a tela de login.
  const waitingForSession = sessionPending && !currentUserEmail;

  if (isLoading || waitingForSession) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="gap-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!invitation) {
    return (
      <InvitationShell
        title="Convite não encontrado"
        description="O link pode estar incorreto ou o convite já não existe mais."
      >
        <Button asChild variant="outline">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </InvitationShell>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <InvitationShell
        title="Convite indisponível"
        description={
          STATUS_MESSAGES[invitation.status] ?? "Este convite não está ativo."
        }
      >
        <Button asChild variant="outline">
          <Link href="/dashboard">Ir para o app</Link>
        </Button>
      </InvitationShell>
    );
  }

  if (invitation.isExpired) {
    return (
      <InvitationShell
        title="Convite expirado"
        description={`O convite para ${invitation.organizationName} expirou. Peça um novo convite a um administrador.`}
      />
    );
  }

  const acceptPath = `/accept-invitation/${invitationId}`;
  const isBusy = acceptInvitation.isPending || rejectInvitation.isPending;

  const header = (
    <CardHeader>
      <div className="mb-2 flex items-center gap-3">
        <Avatar className="size-12">
          {invitation.organizationLogo && (
            <AvatarImage
              src={invitation.organizationLogo}
              alt={invitation.organizationName}
            />
          )}
          <AvatarFallback>
            <Building2 className="size-5" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <CardTitle className="truncate">
            {invitation.organizationName}
          </CardTitle>
          <CardDescription className="truncate">
            Convite de {invitation.inviterName}
          </CardDescription>
        </div>
      </div>
      <CardDescription>
        Você foi convidado para participar como{" "}
        <strong className="text-foreground">
          {roleLabel(invitation.role)}
        </strong>
        .
      </CardDescription>
    </CardHeader>
  );

  if (!activeEmail) {
    return (
      <Card className="w-full max-w-md">
        {header}
        <CardContent>
          <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
            O convite foi enviado para{" "}
            <strong className="text-foreground">{invitation.email}</strong>.
            Entre ou crie sua conta com esse e-mail para aceitar.
          </p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button asChild className="flex-1">
            <Link href={`/login?redirectTo=${encodeURIComponent(acceptPath)}`}>
              Entrar
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link
              href={`/cadastro?redirectTo=${encodeURIComponent(acceptPath)}`}
            >
              Criar conta
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (activeEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <Card className="w-full max-w-md">
        {header}
        <CardContent>
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            Este convite é para <strong>{invitation.email}</strong>, mas você
            está conectado como <strong>{activeEmail}</strong>. Entre com a
            conta correta para aceitar.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href={`/login?redirectTo=${encodeURIComponent(acceptPath)}`}>
              Entrar com outra conta
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      {header}
      <CardFooter className="gap-2">
        <Button
          className="flex-1"
          disabled={isBusy}
          onClick={() =>
            acceptInvitation.mutate(
              { invitationId },
              {
                onSuccess: () => {
                  // Aceitar troca a org ativa pra que acabou de aceitar — sem
                  // isto o dashboard abriria com dados em cache da org
                  // anterior (se a pessoa já usava o app com outra empresa).
                  queryClient.clear();
                  router.push("/dashboard");
                  router.refresh();
                },
              },
            )
          }
        >
          {acceptInvitation.isPending && <Spinner />}
          Aceitar convite
        </Button>
        <Button
          variant="outline"
          disabled={isBusy}
          onClick={() =>
            rejectInvitation.mutate(
              { invitationId },
              { onSuccess: () => router.push("/") },
            )
          }
        >
          {rejectInvitation.isPending && <Spinner />}
          Recusar
        </Button>
      </CardFooter>
    </Card>
  );
}
