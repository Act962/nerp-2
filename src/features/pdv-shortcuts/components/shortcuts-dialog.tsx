"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { hasFullAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  PDV_SHORTCUTS,
  type PdvActionId,
  type PdvBindings,
  keyFromEvent,
} from "../shortcuts";
import {
  usePdvShortcuts,
  useUpdatePdvShortcuts,
} from "../hooks/use-pdv-shortcuts";

function defaultsMap(): PdvBindings {
  const result = {} as PdvBindings;
  for (const shortcut of PDV_SHORTCUTS)
    result[shortcut.id] = shortcut.defaultKey;
  return result;
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { bindings } = usePdvShortcuts();
  const { member } = useCurrentMember();
  const update = useUpdatePdvShortcuts();
  const isAdmin = hasFullAccess(member?.role);

  const [local, setLocal] = useState<PdvBindings>(bindings);
  const [capturing, setCapturing] = useState<PdvActionId | null>(null);

  // Sincroniza o estado local quando o diálogo abre com os atalhos vigentes.
  useEffect(() => {
    if (open) {
      setLocal(bindings);
      setCapturing(null);
    }
  }, [open, bindings]);

  // Enquanto captura, a próxima tecla vira o atalho da ação selecionada.
  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.key === "Escape") {
        setCapturing(null);
        return;
      }
      // Ignora teclas de modificador isoladas.
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
      setLocal((current) => ({ ...current, [capturing]: keyFromEvent(event) }));
      setCapturing(null);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [capturing]);

  const duplicates = new Set(
    Object.values(local).filter(
      (key, index, all) => all.indexOf(key) !== index,
    ),
  );

  const save = () => {
    if (duplicates.size > 0) return;
    update.mutate(
      { bindings: local },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos do PDV</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Clique numa tecla para reatribuir. Vale para todos os operadores da organização."
              : "Teclas de atalho da frente de caixa. Só o administrador pode alterá-las."}
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y">
          {PDV_SHORTCUTS.map((shortcut) => {
            const key = local[shortcut.id];
            const isDuplicate = duplicates.has(key);
            return (
              <li
                key={shortcut.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="text-sm">{shortcut.label}</span>
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "min-w-24 font-mono",
                      capturing === shortcut.id && "border-primary",
                      isDuplicate && "border-destructive text-destructive",
                    )}
                    onClick={() => setCapturing(shortcut.id)}
                  >
                    {capturing === shortcut.id ? "Pressione…" : key}
                  </Button>
                ) : (
                  <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs">
                    {key}
                  </kbd>
                )}
              </li>
            );
          })}
        </ul>

        {duplicates.size > 0 && (
          <p className="text-xs text-destructive">
            Há teclas repetidas — cada ação precisa de uma tecla única.
          </p>
        )}

        {isAdmin && (
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLocal(defaultsMap())}
            >
              Restaurar padrão
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={update.isPending || duplicates.size > 0}
            >
              {update.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
