"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import {
  Copy,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  QrCode,
  RotateCw,
  Trash2,
} from "lucide-react";
import {
  useDeleteJoinLink,
  useJoinLinks,
  useRegenerateJoinLink,
} from "../hooks/use-join-link";
import { type JoinLinkDraft, JoinLinkDialog } from "./join-link-dialog";

// `Map<string, string>` explícito: as chaves salvas no link são strings livres
// vindas do banco, e a inferência a partir do `as const` fecharia a Map na união
// literal — o `.get()` não aceitaria a chave.
const PERMISSION_LABELS = new Map<string, string>(
  PAGE_PERMISSIONS.map((permission) => [permission.key, permission.label]),
);

/**
 * Links abertos de entrada na empresa, com QR Code.
 *
 * Diferente do convite por e-mail (nominal, uso único), estes são reutilizáveis:
 * qualquer pessoa com a URL ou que leia o QR entra. Por isso o papel é sempre
 * "Membro" — link que circula em grupo não pode conceder administrador.
 *
 * São vários porque cada perfil de entrada libera páginas diferentes; o nome é
 * o que separa "Promotores" de "Coordenação" numa lista de URLs idênticas à
 * primeira vista.
 */
export function JoinLinkCard({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useJoinLinks();
  const regenerate = useRegenerateJoinLink();
  const remove = useDeleteJoinLink();
  const [editing, setEditing] = useState<JoinLinkDraft | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrFor, setQrFor] = useState<string | null>(null);

  if (!canManage) return null;

  const links = data?.links ?? [];

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

  const openDialog = (draft: JoinLinkDraft | null) => {
    setEditing(draft);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4" /> Links de convite
        </CardTitle>
        <CardDescription>
          Cada link entrega um conjunto próprio de páginas. Quem abrir (ou ler o
          QR Code) se cadastra e entra como <strong>Membro</strong>.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => openDialog(null)}
          >
            <Plus className="size-4" /> Gerar link
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : links.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum link ativo. Gere um para permitir que novas pessoas entrem
            sem convite nominal.
          </p>
        ) : (
          links.map((link) => (
            <div key={link.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">
                    {link.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {link.permissions.length === 0
                      ? "Nenhuma página liberada"
                      : `${link.permissions.length} página(s) liberada(s)`}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setQrFor((current) =>
                      current === link.id ? null : link.id,
                    )
                  }
                >
                  <QrCode className="size-4" />
                  {qrFor === link.id ? "Ocultar QR" : "QR"}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Ações de ${link.name}`}
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        openDialog({
                          id: link.id,
                          name: link.name,
                          permissions: link.permissions,
                        })
                      }
                    >
                      <Pencil /> Editar nome e páginas
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={regenerate.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Gerar um novo endereço? Quem já tiver a URL atual não conseguirá mais entrar.",
                          )
                        ) {
                          regenerate.mutate({ id: link.id });
                        }
                      }}
                    >
                      <RotateCw /> Gerar novo endereço
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Excluir o link "${link.name}"? Quem tiver a URL não conseguirá mais entrar.`,
                          )
                        ) {
                          remove.mutate({ id: link.id });
                        }
                      }}
                    >
                      <Trash2 /> Excluir link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                {qrFor === link.id && (
                  // Fundo branco fixo: leitor de QR precisa de contraste, e no
                  // tema escuro o código sumiria.
                  <div className="mx-auto shrink-0 rounded-xl border bg-white p-4 sm:mx-0">
                    <QRCodeSVG value={link.url} size={148} level="M" />
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
                      Este link expirou — gere um novo endereço.
                    </p>
                  )}

                  {link.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {link.permissions.map((key) => (
                        <Badge key={key} variant="secondary">
                          {PERMISSION_LABELS.get(key) ?? key}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <JoinLinkDialog
        draft={editing}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      />
    </Card>
  );
}
