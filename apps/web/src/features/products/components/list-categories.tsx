"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategoryModal } from "@/hooks/modals/use-category-modal";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Copy,
  FolderOpen,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ListCategories() {
  const queryClient = useQueryClient();
  const { onOpen, onOpenDelete, setCategory, setMode } = useCategoryModal();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const duplicateMutation = useMutation(
    orpc.categories.duplicate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(orpc.categories.list.queryOptions());
        queryClient.invalidateQueries(
          orpc.categories.listWithoutSubcategory.queryOptions(),
        );

        toast.success("Categoria duplicada com sucesso!");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleDuplicate = (categoryId: string) => {
    duplicateMutation.mutate({
      id: categoryId,
    });
  };

  const { data, isPending } = useQuery(orpc.categories.list.queryOptions());

  const categories = data?.categories;

  const toggleExpand = (id: string) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((catId) => catId !== id) : [...prev, id],
    );
  };
  return (
    <Card>
      <CardHeader>
        <InputGroup>
          <InputGroupAddon>
            <Search className="h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar categorias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {isPending &&
            Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                className="h-12 w-full rounded-lg p-4"
                key={index + "category"}
              />
            ))}

          {!isPending && categories?.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderOpen />
                </EmptyMedia>
                <EmptyTitle>Nenhuma categoria encontrada</EmptyTitle>
                <EmptyDescription>
                  Crie uma nova categoria para começar a organizar seus
                  produtos.
                </EmptyDescription>
                <EmptyContent>
                  <Button onClick={onOpen}>Criar categoria</Button>
                </EmptyContent>
              </EmptyHeader>
            </Empty>
          )}

          {!isPending &&
            categories &&
            categories.length > 0 &&
            categories.map((category) => (
              <div key={category.id}>
                <div className="group flex items-center justify-between rounded-lg border p-4 hover:bg-accent">
                  <div className="flex items-center gap-3">
                    {category.children.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleExpand(category.id)}
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            expandedCategories.includes(category.id)
                              ? "rotate-90"
                              : ""
                          }`}
                        />
                      </Button>
                    ) : (
                      <div className="w-6" />
                    )}
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{category.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Slug: {category.slug}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {category.productsCount} produtos
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            onOpen();
                            setCategory(category);
                            setMode("update");
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(category.id)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onOpen();
                            setCategory(category);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar subcategoria
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            onOpenDelete();
                            setCategory(category);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {expandedCategories.includes(category.id) &&
                  category.children.length > 0 && (
                    <div className="ml-9 mt-2 space-y-2">
                      {category.children.map((child) => (
                        <div
                          key={child.id}
                          className="group flex items-center justify-between rounded-lg border border-dashed p-3 hover:bg-accent"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6" />
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm font-medium">
                                {child.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Slug: {child.slug}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">
                              {child.productsCount} produtos
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    onOpen();
                                    setCategory({
                                      ...child,
                                      parentId: child.parentId ?? undefined,
                                    });
                                    setMode("update");
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicate(child.id)}
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    onOpenDelete();
                                    setCategory({
                                      ...child,
                                      parentId: child.parentId ?? undefined,
                                    });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
