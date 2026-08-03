"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TRADE_ROLES, roleLabel, tradeRoleLabel } from "@/lib/permissions";
import {
  Factory,
  MoreVertical,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  useMembers,
  useUpdateMemberPromotorVisibility,
  useUpdateMemberRole,
  useUpdateMemberTradeRole,
} from "../hooks/use-members";
import { MemberIndustriesDialog } from "./member-industries-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";

interface MembersPanelProps {
  canManage: boolean;
  currentMemberId: string | null;
}

export function MembersPanel({
  canManage,
  currentMemberId,
}: MembersPanelProps) {
  const { members, isLoading } = useMembers();
  const updateRole = useUpdateMemberRole();
  const updateTradeRole = useUpdateMemberTradeRole();
  const updateVisibility = useUpdateMemberPromotorVisibility();
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [industriesFor, setIndustriesFor] = useState<{
    id: string;
    name: string;
    supplierIds: string[];
  } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" />
          Membros
        </CardTitle>
        <CardDescription>
          Quem tem acesso à organização e com qual cargo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isOwner = member.role === "owner";
              const isSelf = member.id === currentMemberId;
              // Dono e a própria conta são protegidos no backend também.
              const canActOnMember = canManage && !isOwner && !isSelf;

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Avatar className="size-10">
                    {member.image && (
                      <AvatarImage src={member.image} alt={member.name} />
                    )}
                    <AvatarFallback>
                      {member.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">
                      {member.name}
                      {isSelf && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <Badge variant={isOwner ? "default" : "outline"}>
                        {isOwner && <ShieldCheck />}
                        {roleLabel(member.role)}
                      </Badge>
                      {member.tradeRole && (
                        <Badge variant="secondary">
                          {tradeRoleLabel(member.tradeRole)}
                        </Badge>
                      )}
                    </div>

                    {canManage && (
                      <label
                        htmlFor={`promotor-photo-${member.id}`}
                        className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <Switch
                          id={`promotor-photo-${member.id}`}
                          checked={member.showInPromotorPhoto}
                          disabled={updateVisibility.isPending}
                          onCheckedChange={(visible) =>
                            updateVisibility.mutate({
                              memberId: member.id,
                              visible,
                            })
                          }
                        />
                        Exibir no App Promotor
                      </label>
                    )}
                  </div>

                  {canActOnMember && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={updateRole.isPending}
                          aria-label={`Ações de ${member.name}`}
                        >
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            updateRole.mutate({
                              memberId: member.id,
                              role:
                                member.role === "admin" ? "member" : "admin",
                            })
                          }
                        >
                          <UserCog />
                          {member.role === "admin"
                            ? "Rebaixar para Membro"
                            : "Tornar Administrador"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                          Cargo no Trade
                        </DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={member.tradeRole ?? "nenhum"}
                          onValueChange={(value) =>
                            updateTradeRole.mutate({
                              memberId: member.id,
                              tradeRole:
                                value === "nenhum"
                                  ? null
                                  : (value as (typeof TRADE_ROLES)[number]["value"]),
                            })
                          }
                        >
                          <DropdownMenuRadioItem value="nenhum">
                            Nenhum
                          </DropdownMenuRadioItem>
                          {TRADE_ROLES.map((option) => (
                            <DropdownMenuRadioItem
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            setIndustriesFor({
                              id: member.id,
                              name: member.name,
                              supplierIds: member.supplierIds,
                            })
                          }
                        >
                          <Factory />
                          Indústrias ({member.supplierIds.length})
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            setRemoving({ id: member.id, name: member.name })
                          }
                        >
                          <Trash2 />
                          Remover da organização
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {industriesFor && (
        <MemberIndustriesDialog
          memberId={industriesFor.id}
          memberName={industriesFor.name}
          currentSupplierIds={industriesFor.supplierIds}
          open={!!industriesFor}
          onOpenChange={(open) => !open && setIndustriesFor(null)}
        />
      )}

      {removing && (
        <RemoveMemberDialog
          memberId={removing.id}
          memberName={removing.name}
          open={!!removing}
          onOpenChange={(open) => !open && setRemoving(null)}
        />
      )}
    </Card>
  );
}
