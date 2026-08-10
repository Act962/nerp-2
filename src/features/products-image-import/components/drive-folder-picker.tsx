"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight, FileImage, Folder, Loader2 } from "lucide-react";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

// Modal simples: navega pelo Drive (parentId opcional), mostra pastas +
// (opcionalmente) imagens. Ao confirmar uma pasta, o caller recebe:
//   { folderId, folderName, imagesCount }
// e é responsável por listar as imagens de novo pra fazer download+match.

interface DrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (folder: { id: string; name: string }) => void;
}

interface DriveNode {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  isImage: boolean;
}

export function DriveFolderPicker({
  open,
  onOpenChange,
  onConfirm,
}: DrivePickerProps) {
  const [stack, setStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Meu Drive" },
  ]);
  const [items, setItems] = useState<DriveNode[]>([]);

  const listMutation = useMutation(
    orpc.googleDrive.listChildren.mutationOptions({}),
  );

  const current = stack[stack.length - 1];

  const listAsync = listMutation.mutateAsync;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listAsync({ parentId: current.id, onlyImages: true })
      .then((data) => {
        if (!cancelled) setItems(data.files);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, current.id, listAsync]);

  function enterFolder(node: DriveNode) {
    setStack((prev) => [...prev, { id: node.id, name: node.name }]);
  }
  function popTo(index: number) {
    setStack((prev) => prev.slice(0, index + 1));
  }

  function reset() {
    setStack([{ id: null, name: "Meu Drive" }]);
    setItems([]);
  }

  const folders = items.filter((item) => item.isFolder);
  const images = items.filter((item) => item.isImage);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Escolher pasta do Google Drive</DialogTitle>
          <DialogDescription>
            Navegue até a pasta que tem as fotos nomeadas pelo SKU. As imagens
            aparecem só como referência — quem se importa é a pasta.
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {stack.map((crumb, index) => (
            <span key={crumb.id ?? "root"} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3" />}
              <button
                type="button"
                className="rounded px-1 hover:bg-accent hover:text-foreground"
                onClick={() => popTo(index)}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="min-h-[240px] max-h-[360px] overflow-y-auto rounded-md border">
          {listMutation.isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Pasta vazia (ou sem imagens).
            </p>
          ) : (
            <ul className="divide-y">
              {folders.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                    onClick={() => enterFolder(node)}
                  >
                    <Folder className="size-4 text-amber-600" />
                    <span className="truncate">{node.name}</span>
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
              {images.slice(0, 30).map((node) => (
                <li
                  key={node.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <FileImage className="size-3.5" />
                  <span className="truncate">{node.name}</span>
                </li>
              ))}
              {images.length > 30 && (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  … e mais {images.length - 30} imagens
                </li>
              )}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (current.id) onConfirm({ id: current.id, name: current.name });
            }}
            disabled={!current.id || images.length === 0}
          >
            Usar esta pasta{" "}
            {images.length > 0 &&
              `(${images.length} imagem${images.length === 1 ? "" : "s"})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
