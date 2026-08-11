"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import placeholder from "@/assets/background-default-image.svg";

import { Button } from "@/components/ui/button";
import {
  Copy,
  Eye,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useProductModal } from "@/hooks/modals/use-product-modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { useBulkUpdateProducts } from "@/features/products/hooks/use-products";
import { FilterProducts } from "./filters";
import { currencyFormatter } from "@/utils/currency-formatter";
import { CalendarFilter } from "./filter-calendar";
import Image from "next/image";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  salePrice: number;
  costPrice: number;
  currentStock: number;
  minStock: number;
  image: string;
  isActive: boolean;
}

export interface Categories {
  id: string;
  name: string;
  isActive: boolean;
  slug: string;
  image: string | null;
  order: number;
}

interface ProductTableProps {
  products: Product[];
  categories: Categories[];
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  // Total de produtos que casam com o filtro (todas as páginas). Usado para
  // oferecer "aplicar em todos os N produtos filtrados" além dos visíveis.
  totalCount?: number;
  // Filtro atual — enviado ao bulk quando aplica em todos, para o server
  // atualizar apenas o mesmo escopo que o usuário está vendo.
  activeFilter?: {
    categorySlugs?: string[];
    search?: string;
  };
}

function getStockStatus(current: number, min: number) {
  if (current === 0)
    return {
      label: "Sem estoque",
      className: "bg-red-500 text-red-50",
    };
  if (current < min)
    return {
      label: "Estoque baixo",
      className: "bg-yellow-500 text-yellow-50",
    };
  return {
    label: "Em estoque",
    className: "bg-green-500 text-green-50",
  };
}

export function ProductsTable({
  products,
  categories,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  totalCount,
  activeFilter,
}: ProductTableProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  // Quando `true`, os dropdowns de bulk aplicam em TODOS os produtos que
  // casam com o filtro atual (não só nos IDs marcados). Volta pra `false`
  // depois de aplicar ou quando a seleção muda.
  const [applyToAll, setApplyToAll] = useState(false);
  const { onOpen } = useProductModal();

  useBarcodeScan(true, (barcode) => {
    setSearchTerm(barcode);
  });

  const duplicateProductMutation = useMutation(
    orpc.products.duplicate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.products.list.key(),
        });

        toast.success(`Produto duplicado com sucesso!`);
      },
      onError: () => {
        toast.error(`Erro ao duplicar produto!`);
      },
    }),
  );

  const onDuplicate = (id: string) => {
    duplicateProductMutation.mutate({
      productId: id,
    });
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm),
  );

  const toggleSelectAll = () => {
    setApplyToAll(false);
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setApplyToAll(false);
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const bulkUpdate = useBulkUpdateProducts();

  // Aplica um patch (ex.: { isActive: true }) no escopo escolhido.
  //   `applyToAll` true  → todos os produtos que casam com o filtro atual,
  //                        mesmo os das outras páginas (envia `all: true`).
  //   `applyToAll` false → só os produtos marcados na página visível.
  const applyPatch = (patch: {
    isActive?: boolean;
    trackStock?: boolean;
    showInCatalog?: boolean;
  }) => {
    if (applyToAll) {
      bulkUpdate.mutate(
        {
          all: true,
          filter: {
            categorySlugs: activeFilter?.categorySlugs,
            // Prioriza a busca local (input desta tabela) sobre o filtro do
            // container — os dois casam com o que está sendo mostrado.
            search:
              searchTerm.trim() || activeFilter?.search || undefined,
          },
          patch,
        },
        {
          onSuccess: () => {
            setSelectedProducts([]);
            setApplyToAll(false);
          },
        },
      );
      return;
    }
    if (selectedProducts.length === 0) return;
    bulkUpdate.mutate(
      { productIds: selectedProducts, patch },
      { onSuccess: () => setSelectedProducts([]) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nome, SKU ou código de barras..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <InputGroupAddon align="inline-end" className="cursor-pointer">
                <XIcon className="size-4" onClick={() => setSearchTerm("")} />
              </InputGroupAddon>
            )}
          </InputGroup>
          <CalendarFilter>
            <span className="hidden sm:block">Calendário</span>
          </CalendarFilter>
          <FilterProducts categories={categories} />
        </div>
      </CardHeader>
      <CardContent>
        {selectedProducts.length > 0 && (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-muted/50 p-3">
            {/* Banner "aplicar em todos" — padrão Gmail: quando todos da página
              estão marcados e existem mais produtos no filtro, oferece
              estender pra TODAS as páginas. `applyToAll` altera o alvo dos
              dropdowns abaixo sem exigir marcar item-por-item. */}
            {typeof totalCount === "number" &&
              totalCount > filteredProducts.length &&
              selectedProducts.length === filteredProducts.length && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-background px-3 py-2 text-sm">
                  {applyToAll ? (
                    <>
                      <span className="font-medium">
                        Todos os {totalCount} produtos filtrados serão
                        atualizados.
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => setApplyToAll(false)}
                      >
                        Voltar a selecionar apenas os desta página
                      </Button>
                    </>
                  ) : (
                    <>
                      <span>
                        Os {filteredProducts.length} produtos desta página
                        estão selecionados.
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => setApplyToAll(true)}
                      >
                        Selecionar todos os {totalCount} produtos filtrados
                      </Button>
                    </>
                  )}
                </div>
              )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {applyToAll
                  ? `${totalCount ?? filteredProducts.length} produtos filtrados`
                  : `${selectedProducts.length} ${
                      selectedProducts.length === 1
                        ? "produto selecionado"
                        : "produtos selecionados"
                    }`}
              </span>
              {!applyToAll && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() =>
                    setSelectedProducts(filteredProducts.map((p) => p.id))
                  }
                  disabled={
                    selectedProducts.length === filteredProducts.length ||
                    filteredProducts.length === 0
                  }
                >
                  Selecionar todos os {filteredProducts.length} desta página
                </Button>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
              {/* Cada dropdown aplica um patch nos selecionados. Ação
                imediata (sem confirmação): "N produtos atualizados" no toast
                e o service em memória invalida a lista. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkUpdate.isPending}
                  >
                    Produto ativo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => applyPatch({ isActive: true })}
                  >
                    Marcar como ativo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => applyPatch({ isActive: false })}
                  >
                    Marcar como inativo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkUpdate.isPending}
                  >
                    Controlar estoque
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => applyPatch({ trackStock: true })}
                  >
                    Habilitar controle
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => applyPatch({ trackStock: false })}
                  >
                    Desabilitar controle (vende ilimitado)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkUpdate.isPending}
                  >
                    Exibir no Catálogo Online
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => applyPatch({ showInCatalog: true })}
                  >
                    Exibir no catálogo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => applyPatch({ showInCatalog: false })}
                  >
                    Ocultar do catálogo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedProducts.length === filteredProducts.length &&
                      filteredProducts.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const stockStatus = getStockStatus(
                  product.currentStock,
                  product.minStock,
                );
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Image
                          src={product.image || placeholder}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="rounded-md"
                        />
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Cód. Barras: {product.barcode}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-muted-foreground">
                      {product.sku || "N/A"}
                    </TableCell>
                    <TableCell>{product.category || "N/A"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      R$ {currencyFormatter(product.salePrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">
                        {product.currentStock} un
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Min: {product.minStock}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={stockStatus.className}>
                        {stockStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/produtos/${product.id}`}>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/produtos/${product.id}/editar`}>
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            onClick={() => onDuplicate(product.id)}
                            className="cursor-pointer"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() => {
                              onOpen(product);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredProducts.length} produtos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPreviousPage}
              onClick={onPreviousPage}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={onNextPage}
            >
              Próximo
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
