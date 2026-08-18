"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  Building2,
  EditIcon,
  EyeIcon,
  MoreVerticalIcon,
  SearchIcon,
  Stamp,
  Trash2Icon,
} from "lucide-react";
import { useSupplier } from "../hooks/use-supplier";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ViewSupplier } from "./view-supplier";
import { EditSupplier } from "./edit-supplier";
import { DeleteSupplier } from "./delete-supplier";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

/** Gera os itens de paginação com reticências para muitas páginas. */
function getPageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const items: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push("ellipsis");
    items.push(p);
    prev = p;
  }
  return items;
}

export function ListSuppliers({ readOnly = false }: { readOnly?: boolean }) {
  const [supplierId, setSupplierId] = useState("");
  const [openViewModal, setOpenViewModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 400);

  const { suppliers, isLoading, totalCount, totalPages } = useSupplier({
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const pageItems = getPageItems(page, totalPages);
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar por nome, documento ou e-mail..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </InputGroup>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Logo</TableHead>
                  <TableHead className="w-24">Senha do mês</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Pessoa de Contato</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow className="h-24">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <TableCell key={index}>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-4 w-full mt-2" />
                        ))}
                      </TableCell>
                    ))}
                  </TableRow>
                )}

                {!isLoading && suppliers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Nenhum fornecedor encontrado.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div className="flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
                          {supplier.logo ? (
                            // biome-ignore lint/performance/noImgElement: miniatura de chave do R2
                            <img
                              src={constructUrl(supplier.logo)}
                              alt={supplier.name}
                              loading="lazy"
                              className="size-full object-contain"
                            />
                          ) : (
                            <Building2 className="size-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* A senha do mês é o que libera a indústria para o
                          promotor fotografar (`capture-wizard`). Sem ela a
                          marca fica bloqueada em campo, então a falta precisa
                          aparecer aqui, não só na hora da captura. */}
                        {supplier.actionCodeImage ? (
                          <div className="flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
                            {/* biome-ignore lint/performance/noImgElement: miniatura de chave do R2 */}
                            <img
                              src={constructUrl(supplier.actionCodeImage)}
                              alt={`Senha do mês de ${supplier.name}`}
                              loading="lazy"
                              className="size-full object-contain"
                            />
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-300 text-amber-700"
                          >
                            <Stamp className="size-3" /> Sem senha
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{supplier.name}</span>
                          {supplier.tradeName && (
                            <span className="text-xs text-muted-foreground">
                              {supplier.tradeName}
                            </span>
                          )}
                          {supplier.document && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {supplier.document}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {supplier.personType === "FISICA"
                            ? "Pessoa Física"
                            : "Pessoa Jurídica"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {supplier.phone && (
                            <span className="text-sm">{supplier.phone}</span>
                          )}
                          {supplier.email && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {supplier.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.contactPerson || "—"}</TableCell>
                      <TableCell>
                        {supplier.city && supplier.state
                          ? `${supplier.city}/${supplier.state}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={supplier.isActive ? "default" : "secondary"}
                        >
                          {supplier.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVerticalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSupplierId(supplier.id);
                                setOpenViewModal(true);
                              }}
                            >
                              <EyeIcon className="size-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            {!readOnly && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSupplierId(supplier.id);
                                    setOpenEditModal(true);
                                  }}
                                >
                                  <EditIcon className="size-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    setSupplierId(supplier.id);
                                    setOpenDeleteModal(true);
                                  }}
                                >
                                  <Trash2Icon className="size-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {!isLoading && totalCount > 0 && (
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {from}–{to} de {totalCount} fornecedor(es)
              </p>

              {totalPages > 1 && (
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        className={cn(
                          "cursor-pointer select-none",
                          page <= 1 && "pointer-events-none opacity-50",
                        )}
                        aria-disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      />
                    </PaginationItem>

                    {pageItems.map((item, i) =>
                      item === "ellipsis" ? (
                        <PaginationItem key={`e-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink
                            className="cursor-pointer select-none"
                            isActive={item === page}
                            onClick={() => setPage(item)}
                          >
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}

                    <PaginationItem>
                      <PaginationNext
                        className={cn(
                          "cursor-pointer select-none",
                          page >= totalPages &&
                            "pointer-events-none opacity-50",
                        )}
                        aria-disabled={page >= totalPages}
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ViewSupplier
        id={supplierId}
        open={openViewModal}
        onOpenChange={setOpenViewModal}
      />
      <EditSupplier
        id={supplierId}
        open={openEditModal}
        onOpenChange={setOpenEditModal}
      />
      <DeleteSupplier
        id={supplierId}
        open={openDeleteModal}
        onOpenChange={setOpenDeleteModal}
      />
    </>
  );
}
