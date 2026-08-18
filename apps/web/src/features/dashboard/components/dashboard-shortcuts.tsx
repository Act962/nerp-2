"use client";

import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import {
  PAGE_PERMISSIONS,
  hasFullAccess,
  memberHasPermission,
  type PagePermissionKey,
} from "@/lib/permissions";
import Link from "next/link";

// Atalhos que o usuário escolheu em Configurações → Módulos. Some inteiro
// quando ninguém marcou nada — não é para ocupar espaço sem servir.
export function DashboardShortcuts() {
  const { member } = useCurrentMember();

  const chosen = new Set(member?.dashboardModules ?? []);
  const orgDisabled = new Set(member?.orgDisabledModules ?? []);
  const fullAccess = hasFullAccess(member?.role);

  const shortcuts = PAGE_PERMISSIONS.filter((page) => {
    if (!chosen.has(page.key)) return false;
    if (orgDisabled.has(page.key)) return false;
    if (fullAccess) return true;
    return memberHasPermission(
      member ? { role: member.role, permissions: member.permissions } : null,
      page.key as PagePermissionKey,
    );
  });

  if (shortcuts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {shortcuts.map((shortcut) => (
        <Button key={shortcut.key} asChild variant="outline" size="sm">
          <Link href={shortcut.href}>{shortcut.label}</Link>
        </Button>
      ))}
    </div>
  );
}
