"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useSetCancelPin,
  useUpdateRequireCancelAuth,
} from "@/features/cancel-auth/hooks/use-cancel-auth";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { orpc } from "@/lib/orpc";
import { hasFullAccess, memberCan } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export function PdvSecurityPanel() {
  const { member } = useCurrentMember();
  const isAdmin = hasFullAccess(member?.role);
  const isAuthorizer = memberCan(member, "autorizar-cancelamento");
  const canManagePin = isAdmin || isAuthorizer;

  const orgQuery = useQuery(orpc.org.get.queryOptions({ input: undefined }));
  const requireCancelAuth =
    orgQuery.data?.organization.requireCancelAuth ?? false;

  const updateRequire = useUpdateRequireCancelAuth();
  const setPin = useSetCancelPin();

  const [pin, setPin1] = useState("");
  const [pin2, setPin2] = useState("");

  const savePin = () => {
    if (pin.length < 4) {
      toast.error("O PIN deve ter de 4 a 6 dígitos");
      return;
    }
    if (pin !== pin2) {
      toast.error("Os PINs não coincidem");
      return;
    }
    setPin.mutate(
      { pin },
      {
        onSuccess: () => {
          setPin1("");
          setPin2("");
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Autorização de cancelamento</CardTitle>
          <CardDescription>
            Exige a aprovação de um supervisor para remover um item ou reduzir a
            quantidade no PDV. O caixa gera um QR (ou o supervisor digita o PIN
            na tela) e a ação só ocorre após a autorização.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="require-cancel-auth">
                Exigir autorização no PDV
              </Label>
              <p className="text-sm text-muted-foreground">
                {requireCancelAuth ? "Ativado" : "Desativado"}
              </p>
            </div>
            <Switch
              id="require-cancel-auth"
              checked={requireCancelAuth}
              disabled={
                !isAdmin || updateRequire.isPending || orgQuery.isPending
              }
              onCheckedChange={(checked) =>
                updateRequire.mutate({ require: checked })
              }
            />
          </div>
          {!isAdmin && (
            <p className="mt-2 text-xs text-muted-foreground">
              Apenas owner/admin podem alterar esta configuração.
            </p>
          )}
        </CardContent>
      </Card>

      {canManagePin && (
        <Card>
          <CardHeader>
            <CardTitle>Meu PIN de autorização</CardTitle>
            <CardDescription>
              Defina um PIN pessoal (4 a 6 dígitos) para autorizar cancelamentos
              digitando-o na tela do PDV. Guarde-o em segredo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pin1">Novo PIN</Label>
                <Input
                  id="pin1"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) =>
                    setPin1(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="4 a 6 dígitos"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pin2">Confirmar PIN</Label>
                <Input
                  id="pin2"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin2}
                  onChange={(e) =>
                    setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="repita o PIN"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={savePin} disabled={setPin.isPending}>
                {setPin.isPending ? "Salvando…" : "Salvar PIN"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPin.mutate({ pin: null })}
                disabled={setPin.isPending}
              >
                Remover PIN
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
