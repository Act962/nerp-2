"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { useSaveJoinLink } from "../hooks/use-join-link";

export interface JoinLinkDraft {
  id?: string;
  name: string;
  permissions: string[];
}

/** Criação/edição de um link de entrada. Editar NÃO troca o token. */
export function JoinLinkDialog({
  draft,
  open,
  onOpenChange,
}: {
  draft: JoinLinkDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const save = useSaveJoinLink();

  useEffect(() => {
    if (!open) return;
    setName(draft?.name ?? "");
    setPermissions(draft?.permissions ?? []);
  }, [open, draft]);

  const toggle = (key: string) =>
    setPermissions((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {draft?.id ? "Editar link" : "Novo link de convite"}
          </DialogTitle>
          <DialogDescription>
            Quem abrir o link (ou ler o QR Code) se cadastra e entra como{" "}
            <strong>Membro</strong>, com as páginas marcadas abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="join-link-name">Nome do link</Label>
            <Input
              id="join-link-name"
              value={name}
              maxLength={60}
              placeholder="Ex.: Promotores, Coordenação, Supervisão…"
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Serve para você diferenciar os links na lista.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Páginas liberadas para quem entrar por este link
            </Label>
            <div className="grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
              {PAGE_PERMISSIONS.map((permission) => (
                <label
                  key={permission.key}
                  htmlFor={`join-perm-${permission.key}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    id={`join-perm-${permission.key}`}
                    checked={permissions.includes(permission.key)}
                    onCheckedChange={() => toggle(permission.key)}
                  />
                  <span className="truncate">{permission.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={save.isPending || !name.trim()}
            onClick={() =>
              save.mutate(
                { id: draft?.id, name: name.trim(), permissions },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {save.isPending && <Spinner />}
            {draft?.id ? "Salvar" : "Gerar link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
