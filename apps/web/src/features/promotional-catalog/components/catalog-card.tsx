"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
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
import { Button } from "@/components/ui/button";
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
import { useDeleteCatalog, useUpdateCatalog } from "../hooks/use-catalog";
import type { CatalogConfig } from "../types";

interface CatalogCardProps {
  id: string;
  name: string;
  updatedAt: Date;
  config?: CatalogConfig;
  onDuplicate?: (id: string, name: string, config: CatalogConfig) => void;
}

export function CatalogCard({ id, name, updatedAt, config, onDuplicate }: CatalogCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(name);

  const deleteMutation = useDeleteCatalog();
  const updateMutation = useUpdateCatalog();

  const handleRename = () => {
    if (!newName.trim()) return;
    updateMutation.mutate({ id, name: newName.trim() });
    setRenameOpen(false);
  };

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">{name}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/catalogo-promocional/${id}`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Renomear
                </DropdownMenuItem>
                {onDuplicate && config && (
                  <DropdownMenuItem onClick={() => onDuplicate(id, name, config)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex-1" />
        <CardFooter className="flex flex-col items-start gap-3 pt-0">
          <p className="text-xs text-muted-foreground">
            Atualizado{" "}
            {formatDistanceToNow(new Date(updatedAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
          <Button asChild className="w-full" size="sm">
            <Link href={`/catalogo-promocional/${id}`}>Editar</Link>
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir catálogo?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O catálogo &quot;{name}&quot; será
              permanentemente excluído.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate({ id });
                setDeleteOpen(false);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear catálogo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-input">Nome</Label>
            <Input
              id="rename-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
