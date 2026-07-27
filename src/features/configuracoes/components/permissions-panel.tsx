"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMembers,
  useUpdateMemberPermissions,
  useUpdateMemberSupervisor,
} from "@/features/members/hooks/use-members";
import { ASSIGNABLE_PERMISSIONS, roleLabel } from "@/lib/permissions";
import { ShieldCheck, Users } from "lucide-react";

// Radix Select não aceita value="", então "sem supervisor" precisa de sentinela.
const NO_SUPERVISOR = "__none__";

export function PermissionsPanel() {
  const { members, isLoading } = useMembers();
  const updatePerms = useUpdateMemberPermissions();

  const updateSupervisor = useUpdateMemberSupervisor();

  const toggle = (
    memberId: string,
    currentPermissions: string[],
    key: string,
  ) => {
    const has = currentPermissions.includes(key);
    const next = has
      ? currentPermissions.filter((p) => p !== key)
      : [...currentPermissions, key];
    updatePerms.mutate({ memberId, permissions: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" />
          Permissões de páginas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Nenhum membro</EmptyTitle>
              <EmptyDescription>
                Convide colaboradores para a organização para liberar páginas.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4">
            {members.map((member) => {
              const isAdminLike =
                member.role === "owner" || member.role === "admin";
              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      {member.image && (
                        <AvatarImage src={member.image} alt={member.name} />
                      )}
                      <AvatarFallback>
                        {member.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <Badge variant={isAdminLike ? "default" : "outline"}>
                      {roleLabel(member.role)}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${member.id}-supervisor`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Supervisor
                    </label>
                    <Select
                      value={member.supervisorId ?? NO_SUPERVISOR}
                      onValueChange={(value) =>
                        updateSupervisor.mutate({
                          memberId: member.id,
                          supervisorId: value === NO_SUPERVISOR ? null : value,
                        })
                      }
                    >
                      <SelectTrigger
                        id={`${member.id}-supervisor`}
                        className="w-full sm:w-64"
                      >
                        <SelectValue placeholder="Sem supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SUPERVISOR}>
                          Sem supervisor
                        </SelectItem>
                        {members
                          .filter((option) => option.id !== member.id)
                          .map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isAdminLike ? (
                    <p className="text-xs text-muted-foreground">
                      {member.role === "owner" ? "Owner" : "Admin"} sempre vê
                      todas as páginas.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ASSIGNABLE_PERMISSIONS.map((page) => {
                        const checked = member.permissions.includes(page.key);
                        const id = `${member.id}-${page.key}`;
                        return (
                          <label
                            key={id}
                            htmlFor={id}
                            className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              disabled={updatePerms.isPending}
                              onCheckedChange={() =>
                                toggle(member.id, member.permissions, page.key)
                              }
                            />
                            <span className="truncate">{page.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
