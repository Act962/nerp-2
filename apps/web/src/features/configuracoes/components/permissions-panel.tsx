"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  ASSIGNABLE_PERMISSIONS,
  getGroupedAssignablePermissions,
  roleLabel,
} from "@/lib/permissions";
import { ChevronDown, ShieldCheck, Users } from "lucide-react";

// Radix Select não aceita value="", então "sem supervisor" precisa de sentinela.
const NO_SUPERVISOR = "__none__";

// Permissões agrupadas pelos módulos do menu lateral (calculado uma vez).
const PERMISSION_GROUPS = getGroupedAssignablePermissions();
const ASSIGNABLE_KEYS = new Set(ASSIGNABLE_PERMISSIONS.map((p) => p.key));

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
                    (() => {
                      const grantedCount = member.permissions.filter((key) =>
                        ASSIGNABLE_KEYS.has(key),
                      ).length;
                      // Nasce contraído em todos os membros (defaultOpen ausente).
                      return (
                        <Collapsible>
                          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent [&[data-state=open]>svg]:rotate-180">
                            <span>
                              Permissões de acesso
                              <span className="ml-1 text-muted-foreground">
                                ({grantedCount} liberada
                                {grantedCount === 1 ? "" : "s"})
                              </span>
                            </span>
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="flex flex-col gap-4 pt-3">
                            {PERMISSION_GROUPS.map((group) => (
                              <div
                                key={group.module}
                                className="flex flex-col gap-2"
                              >
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {group.module}
                                </p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {group.permissions.map((page) => {
                                    const checked = member.permissions.includes(
                                      page.key,
                                    );
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
                                            toggle(
                                              member.id,
                                              member.permissions,
                                              page.key,
                                            )
                                          }
                                        />
                                        <span className="truncate">
                                          {page.label}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })()
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
