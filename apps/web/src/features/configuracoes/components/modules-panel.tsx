"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useCurrentMember,
  useUpdateMyModules,
  useUpdateOrgDisabledModules,
} from "@/features/members/hooks/use-members";
import {
  HIDEABLE_MODULES,
  PAGE_PERMISSIONS,
  hasFullAccess,
} from "@/lib/permissions";
import { Building2, LayoutGrid, UserCircle2 } from "lucide-react";

function toggle(list: string[], key: string, shouldInclude: boolean) {
  const withoutKey = list.filter((current) => current !== key);
  return shouldInclude ? [...withoutKey, key] : withoutKey;
}

export function ModulesPanel() {
  const { member, isLoading } = useCurrentMember();
  const updateMyModules = useUpdateMyModules();
  const updateOrgModules = useUpdateOrgDisabledModules();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const orgDisabled = member?.orgDisabledModules ?? [];
  const userHidden = member?.hiddenModules ?? [];
  const dashboardModules = member?.dashboardModules ?? [];
  const canManageOrg = hasFullAccess(member?.role);

  return (
    <div className="space-y-6">
      {canManageOrg && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Módulos da empresa
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Desligue os módulos do NERP que esta empresa não usa. Some do menu
              de todos os membros — quem já tem o link continua conseguindo
              abrir a página.
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {HIDEABLE_MODULES.map((module) => {
              const isEnabled = !orgDisabled.includes(module.key);
              return (
                <div
                  key={module.key}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">{module.label}</span>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      updateOrgModules.mutate({
                        disabledModules: toggle(
                          orgDisabled,
                          module.key,
                          !checked,
                        ),
                      })
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle2 className="size-5" />
            Meu menu lateral
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha o que aparece no seu menu. Vale só para você — não afeta os
            outros membros.
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {HIDEABLE_MODULES.map((module) => {
            const isDisabledByOrg = orgDisabled.includes(module.key);
            const isVisible = !userHidden.includes(module.key);
            return (
              <div
                key={module.key}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{module.label}</p>
                  {isDisabledByOrg && (
                    <p className="text-xs text-muted-foreground">
                      Desligado para toda a empresa
                    </p>
                  )}
                </div>
                <Switch
                  checked={isVisible && !isDisabledByOrg}
                  disabled={isDisabledByOrg}
                  onCheckedChange={(checked) =>
                    updateMyModules.mutate({
                      hiddenModules: toggle(userHidden, module.key, !checked),
                    })
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="size-5" />
            Botões no dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Atalhos que aparecem no topo do seu dashboard, para o que você mais
            usa no dia a dia.
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {PAGE_PERMISSIONS.map((module) => {
            const isDisabledByOrg = orgDisabled.includes(module.key);
            const isOn = dashboardModules.includes(module.key);
            return (
              <div
                key={module.key}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{module.label}</p>
                  {isDisabledByOrg && (
                    <p className="text-xs text-muted-foreground">
                      Desligado para toda a empresa
                    </p>
                  )}
                </div>
                <Switch
                  checked={isOn && !isDisabledByOrg}
                  disabled={isDisabledByOrg}
                  onCheckedChange={(checked) =>
                    updateMyModules.mutate({
                      dashboardModules: toggle(
                        dashboardModules,
                        module.key,
                        checked,
                      ),
                    })
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
