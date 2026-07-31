"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import { Copy, Link2, QrCode, RotateCw, Trash2 } from "lucide-react";
import { useJoinLink, useRotateJoinLink } from "../hooks/use-join-link";

/**
 * Link aberto de entrada na empresa, com QR Code.
 *
 * Diferente do convite por e-mail (nominal, uso único), este é reutilizável:
 * qualquer pessoa com a URL ou que leia o QR entra. Por isso o papel é sempre
 * "Membro" — link que circula em grupo não pode conceder administrador — e
 * quem gera escolhe as páginas liberadas.
 */
export function JoinLinkCard({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useJoinLink();
  const rotate = useRotateJoinLink();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [showQr, setShowQr] = useState(true);

  if (!canManage) return null;

  const link = data?.link ?? null;
  // Ao (re)gerar, mantém o que já estava salvo se o admin não mexeu nas caixas.
  const effectivePermissions =
    permissions.length > 0 ? permissions : (link?.permissions ?? []);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Link:", {
        description: value,
        duration: 15000,
      });
    }
  };

  const toggle = (key: string) => {
    const base =
      permissions.length > 0 ? permissions : (link?.permissions ?? []);
    setPermissions(
      base.includes(key) ? base.filter((k) => k !== key) : [...base, key],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4" /> Link de convite
        </CardTitle>
        <CardDescription>
          Quem abrir este link (ou ler o QR Code) se cadastra e entra na empresa
          como <strong>Membro</strong>. Marque abaixo as páginas que essa pessoa
          poderá acessar.
        </CardDescription>
        {link && (
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowQr((value) => !value)}
            >
              <QrCode className="size-4" />
              {showQr ? "Ocultar QR" : "Mostrar QR"}
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : link ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {showQr && (
              // Fundo branco fixo: leitor de QR precisa de contraste, e no
              // tema escuro o código sumiria.
              <div className="mx-auto shrink-0 rounded-xl border bg-white p-4 sm:mx-0">
                <QRCodeSVG value={link.url} size={168} level="M" />
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={link.url}
                  className="font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Copiar link"
                  onClick={() => copy(link.url)}
                >
                  <Copy className="size-4" />
                </Button>
              </div>

              {link.isExpired && (
                <p className="text-xs text-destructive">
                  Este link expirou — gere um novo.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={rotate.isPending}
                  onClick={() =>
                    rotate.mutate({
                      enable: true,
                      permissions: effectivePermissions,
                    })
                  }
                >
                  <RotateCw className="size-4" /> Gerar novo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={rotate.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Desativar o link? Quem já tiver a URL não conseguirá mais entrar.",
                      )
                    ) {
                      rotate.mutate({ enable: false, permissions: [] });
                    }
                  }}
                >
                  <Trash2 className="size-4" /> Desativar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Gerar um novo link invalida o anterior.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Nenhum link ativo. Gere um para permitir que novas pessoas entrem
              sem convite nominal.
            </p>
            <Button
              type="button"
              className="gap-1.5"
              disabled={rotate.isPending}
              onClick={() =>
                rotate.mutate({
                  enable: true,
                  permissions: effectivePermissions,
                })
              }
            >
              <Link2 className="size-4" /> Gerar link
            </Button>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label className="text-xs text-muted-foreground">
            Páginas liberadas para quem entrar por este link
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAGE_PERMISSIONS.map((permission) => (
              <label
                key={permission.key}
                htmlFor={`join-perm-${permission.key}`}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  id={`join-perm-${permission.key}`}
                  checked={effectivePermissions.includes(permission.key)}
                  onCheckedChange={() => toggle(permission.key)}
                />
                <span className="truncate">{permission.label}</span>
              </label>
            ))}
          </div>
          {link && (
            <p className="text-xs text-muted-foreground">
              Alterar as marcações só vale depois de clicar em “Gerar novo”.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
