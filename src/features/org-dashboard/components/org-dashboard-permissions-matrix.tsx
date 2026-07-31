"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWidgetCatalog } from "@/features/dashboard-widgets/hooks/use-widget-catalog";
import { useMembers } from "@/features/members/hooks/use-members";
import { hasFullAccess } from "@/lib/permissions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSetMemberPermissions } from "../hooks/use-org-dashboard";

// Matriz `member × widget`. Owner e admin não aparecem: eles têm acesso
// automático (bypass em `visibleOrgWidgetIds`). O gate está no server,
// então esconder aqui é só higiene — se aparecesse, checar/deschecar não
// mudaria o que eles veem.
//
// Dispensa é "set-semantic": o botão "Salvar" envia o Set atual e o server
// substitui — nenhum "diff" no cliente.

interface WidgetRow {
  id: string;
  title: string | null;
  dataSourceKey: string;
  parentId: string | null;
}
interface PermissionRow {
  memberId: string;
  orgDashboardWidgetId: string;
}

export function OrgDashboardPermissionsMatrix({
  widgets,
  permissions,
}: {
  widgets: WidgetRow[];
  permissions: PermissionRow[];
}) {
  const { members, isLoading: loadingMembers } = useMembers();
  const { data: catalog } = useWidgetCatalog();
  const setPermissions = useSetMemberPermissions();

  const labelByKey = useMemo(
    () =>
      new Map(
        (catalog?.widgets ?? []).map((entry) => [entry.key, entry.label]),
      ),
    [catalog],
  );

  // Membros sem full access: são os que aparecem na matriz. Owner/admin já
  // vê tudo por bypass do server.
  const editableMembers = useMemo(
    () => members.filter((member) => !hasFullAccess(member.role)),
    [members],
  );

  // Só widgets de topo aparecem — as permissões dos filhos herdam do pai
  // (regra "pai fechado = filho fechado" do server).
  const topWidgets = widgets.filter((widget) => !widget.parentId);

  // Estado local por membro: começa do servidor, marca "dirty" quando muda,
  // botão "Salvar" envia. Bulk por membro em vez de por célula pra não
  // martelar a API a cada clique.
  type PermSets = Record<string, Set<string>>;
  const initialPerms: PermSets = useMemo(() => {
    const map: PermSets = {};
    for (const member of editableMembers) map[member.id] = new Set();
    for (const perm of permissions) {
      if (map[perm.memberId]) map[perm.memberId].add(perm.orgDashboardWidgetId);
    }
    return map;
  }, [editableMembers, permissions]);
  const [state, setState] = useState<PermSets>(initialPerms);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    setState(initialPerms);
    setDirty(new Set());
  }, [initialPerms]);

  const toggle = useCallback((memberId: string, widgetId: string) => {
    setState((current) => {
      const next: PermSets = { ...current };
      const set = new Set(next[memberId] ?? new Set());
      if (set.has(widgetId)) set.delete(widgetId);
      else set.add(widgetId);
      next[memberId] = set;
      return next;
    });
    setDirty((current) => new Set(current).add(memberId));
  }, []);

  // Ações em massa: marcar/desmarcar TODOS os widgets pra UM membro (linha),
  // ou TODOS os membros pra UM widget (coluna). Continua sendo apenas
  // mutação de estado local — o admin ainda precisa clicar "Salvar" (ou
  // "Salvar tudo") pra persistir.
  const setAllForMember = useCallback((memberId: string, ids: string[]) => {
    setState((current) => ({ ...current, [memberId]: new Set(ids) }));
    setDirty((current) => new Set(current).add(memberId));
  }, []);

  const toggleColumn = useCallback(
    (widgetId: string, enable: boolean) => {
      setState((current) => {
        const next: PermSets = { ...current };
        for (const member of editableMembers) {
          const set = new Set(next[member.id] ?? new Set());
          if (enable) set.add(widgetId);
          else set.delete(widgetId);
          next[member.id] = set;
        }
        return next;
      });
      setDirty(
        (current) =>
          new Set([...current, ...editableMembers.map((member) => member.id)]),
      );
    },
    [editableMembers],
  );

  const saveMember = (memberId: string) => {
    setPermissions.mutate(
      { memberId, widgetIds: [...(state[memberId] ?? new Set())] },
      {
        onSuccess: () => {
          setDirty((current) => {
            const next = new Set(current);
            next.delete(memberId);
            return next;
          });
        },
      },
    );
  };

  // "Salvar tudo" — envia todas as linhas dirty numa sequência (mutações
  // independentes, sem transação — deny-by-default garante coerência mesmo
  // se uma falhar no meio).
  const saveAll = () => {
    for (const memberId of dirty) saveMember(memberId);
  };

  if (loadingMembers) return <Skeleton className="h-96 w-full" />;
  if (topWidgets.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Adicione widgets primeiro na aba "Widgets".
      </p>
    );
  }
  if (editableMembers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todos os membros da organização são owner/admin — eles vêem tudo por
        padrão, sem precisar de configuração.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Owner e admin veem tudo automaticamente. Cada membro abaixo vê somente
          os widgets marcados.
        </p>
        {dirty.size > 0 && (
          <Button
            type="button"
            size="sm"
            disabled={setPermissions.isPending}
            onClick={saveAll}
          >
            Salvar tudo ({dirty.size})
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Membro</TableHead>
              {topWidgets.map((widget) => {
                // Estado da coluna: todos marcados / nenhum / misto — decide
                // se o botão de topo LIGA (nenhum ou misto) ou DESLIGA (todos).
                const columnCount = editableMembers.filter((member) =>
                  (state[member.id] ?? new Set()).has(widget.id),
                ).length;
                const allOn = columnCount === editableMembers.length;
                return (
                  <TableHead
                    key={widget.id}
                    className="min-w-32 whitespace-normal text-center align-bottom text-[10px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>
                        {widget.title ??
                          labelByKey.get(widget.dataSourceKey) ??
                          widget.dataSourceKey}
                      </span>
                      <button
                        type="button"
                        className="text-[9px] text-primary underline underline-offset-2"
                        onClick={() => toggleColumn(widget.id, !allOn)}
                      >
                        {allOn ? "desmarcar tudo" : "marcar todos"}
                      </button>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {editableMembers.map((member) => {
              const set = state[member.id] ?? new Set();
              const isDirty = dirty.has(member.id);
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{member.name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <span>{member.role}</span>
                        <button
                          type="button"
                          className="text-[10px] text-primary underline underline-offset-2"
                          onClick={() =>
                            setAllForMember(
                              member.id,
                              topWidgets.map((widget) => widget.id),
                            )
                          }
                        >
                          tudo
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-primary underline underline-offset-2"
                          onClick={() => setAllForMember(member.id, [])}
                        >
                          nada
                        </button>
                      </div>
                    </div>
                  </TableCell>
                  {topWidgets.map((widget) => (
                    <TableCell key={widget.id} className="text-center">
                      <input
                        type="checkbox"
                        checked={set.has(widget.id)}
                        onChange={() => toggle(member.id, widget.id)}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    {isDirty && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={setPermissions.isPending}
                        onClick={() => saveMember(member.id)}
                      >
                        Salvar
                      </Button>
                    )}
                    {!isDirty && set.size === 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        Sem acesso
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
