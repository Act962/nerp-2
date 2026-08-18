"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabel } from "@/lib/permissions";
import dayjs from "dayjs";
import { Link2, MailPlus, MoreVertical, RotateCw, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCancelInvitation,
  useInvitations,
  useResendInvitation,
} from "../hooks/use-invitations";
import { InviteMemberDialog } from "./invite-member-dialog";

export function InvitationsPanel({ canManage }: { canManage: boolean }) {
  const { invitations, isLoading } = useInvitations("pending");
  const cancelInvitation = useCancelInvitation();
  const resendInvitation = useResendInvitation();
  const [actingId, setActingId] = useState<string | null>(null);

  const isBusy = cancelInvitation.isPending || resendInvitation.isPending;

  // A Clipboard API exige contexto seguro e pode ser negada por permissão —
  // nesse caso mostramos o link para o admin copiar na mão.
  const copyInviteLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link do convite copiado!");
    } catch {
      toast.error("Não foi possível copiar. Link:", {
        description: link,
        duration: 15000,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5" />
          Convites pendentes
        </CardTitle>
        <CardDescription>
          Convites aguardando aceite. O link expira em 48 horas.
        </CardDescription>
        {canManage && (
          <CardAction>
            <InviteMemberDialog>
              <Button size="sm">
                <MailPlus />
                Convidar membro
              </Button>
            </InviteMemberDialog>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : invitations.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Send className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Nenhum convite pendente</EmptyTitle>
              <EmptyDescription>
                Convide alguém por e-mail para participar da organização.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">
                    {invitation.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Convidado por {invitation.inviterName} ·{" "}
                    {invitation.isExpired ? "expirado" : "expira"} em{" "}
                    {dayjs(invitation.expiresAt).format(
                      "DD/MM/YYYY [às] HH:mm",
                    )}
                  </p>
                </div>

                <Badge
                  variant={invitation.isExpired ? "destructive" : "outline"}
                >
                  {invitation.isExpired
                    ? "Expirado"
                    : roleLabel(invitation.role)}
                </Badge>

                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isBusy && actingId === invitation.id}
                        aria-label={`Ações do convite para ${invitation.email}`}
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => copyInviteLink(invitation.inviteLink)}
                      >
                        <Link2 />
                        Copiar link do convite
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setActingId(invitation.id);
                          resendInvitation.mutate({
                            invitationId: invitation.id,
                          });
                        }}
                      >
                        <RotateCw />
                        Reenviar e-mail
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setActingId(invitation.id);
                          cancelInvitation.mutate({
                            invitationId: invitation.id,
                          });
                        }}
                      >
                        <X />
                        Cancelar convite
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
