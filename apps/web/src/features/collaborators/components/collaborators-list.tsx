"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, UsersIcon } from "lucide-react";
import { useState } from "react";
import {
  type Collaborator,
  useMutationDeleteCollaborator,
  useQueryCollaborators,
} from "../hooks/use-collaborators";
import { CollaboratorForm } from "./collaborator-form";

export function CollaboratorsList() {
  const { data, isLoading } = useQueryCollaborators();
  const remove = useMutationDeleteCollaborator();

  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const startEdit = (collaborator: Collaborator) => {
    setEditing(collaborator);
    setEditOpen(true);
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon className="size-6" />
                </EmptyMedia>
                <EmptyTitle>Nenhum colaborador cadastrado</EmptyTitle>
                <EmptyDescription>
                  Adicione colaboradores para identificar quem atende cada
                  pedido.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          {c.photoUrl && (
                            <AvatarImage
                              src={constructUrl(c.photoUrl)}
                              alt={c.name}
                            />
                          )}
                          <AvatarFallback>
                            {c.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.role}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "default" : "outline"}>
                        {c.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => startEdit(c)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Excluir colaborador "${c.name}"?`)) {
                              remove.mutate({ id: c.id });
                            }
                          }}
                          aria-label="Excluir"
                          disabled={remove.isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CollaboratorForm
        open={editOpen}
        onOpenChange={setEditOpen}
        collaborator={editing}
      />
    </>
  );
}
