"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Instagram,
  MessageCircle,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardFooter } from "@/components/ui/card";
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
import { shareImageFile, openWhatsAppText } from "../lib/share";

interface CatalogCardProps {
  id: string;
  name: string;
  thumbnail: string | null;
  updatedAt: Date;
  createdAt: Date;
  createdBy: { name: string; image: string | null } | null;
  onDuplicate?: () => void;
  duplicating?: boolean;
}

export function CatalogCard({
  id,
  name,
  thumbnail,
  createdAt,
  createdBy,
  onDuplicate,
  duplicating,
}: CatalogCardProps) {
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

  const share = async (channel: "wa" | "ig") => {
    if (!thumbnail) {
      toast.info("Abra e edite o catálogo uma vez para gerar a miniatura.");
      return;
    }
    const res = await shareImageFile({
      dataUrl: thumbnail,
      filename: `${name}.jpg`,
      text: name,
    });
    if (res === "downloaded") {
      if (channel === "wa") openWhatsAppText(name);
      else toast.info("Imagem baixada — poste no app do Instagram.");
    }
  };

  return (
    <>
      {/* `h-full` + rodapé em `mt-auto`: a miniatura já tem proporção fixa, mas
          o nome pode quebrar em duas linhas e empurrava o rodapé — os cartões da
          grade ficavam com os botões em alturas diferentes. */}
      <Card className="flex h-full flex-col overflow-hidden">
        <Link
          href={`/catalogo-promocional/${id}`}
          className="block aspect-[3/4] shrink-0 bg-muted"
        >
          {thumbnail ? (
            // biome-ignore lint/performance/noImgElement: miniatura em data URL
            <img
              src={thumbnail}
              alt={name}
              loading="lazy"
              decoding="async"
              // `cover` + topo: catálogo quadrado, story e retrato têm
              // proporções diferentes; com `contain` cada miniatura aparecia
              // num tamanho, deixando a grade irregular. Ancorar no topo
              // preserva o cabeçalho do encarte.
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
              sem prévia
            </div>
          )}
        </Link>

        <div className="flex items-start justify-between gap-2 p-3 pb-1">
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium">{name}</p>
            <div
              className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
              title={
                createdBy?.name ? `Criado por ${createdBy.name}` : undefined
              }
            >
              <Avatar className="size-5 shrink-0">
                {createdBy?.image ? (
                  <AvatarImage src={createdBy.image} alt={createdBy.name} />
                ) : null}
                <AvatarFallback className="text-[9px]">
                  {(createdBy?.name ?? "?").trim().slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {format(new Date(createdAt), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/catalogo-promocional/${id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Renomear
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem disabled={duplicating} onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CardFooter className="mt-auto flex items-center gap-1 p-3 pt-1">
          <Button asChild size="sm" className="flex-1">
            <Link href={`/catalogo-promocional/${id}`}>Editar</Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Compartilhar no WhatsApp"
            onClick={() => share("wa")}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Compartilhar no Instagram"
            onClick={() => share("ig")}
          >
            <Instagram className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir catálogo?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O catálogo &quot;{name}&quot;
              será permanentemente excluído.
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
