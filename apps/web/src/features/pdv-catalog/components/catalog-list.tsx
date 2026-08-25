"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  DownloadIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTradeCatalogs } from "../hooks/use-trade-catalog-doc";
import { CatalogStatusBadge } from "./catalog-status-badge";
import { CreateCatalogDialog } from "./create-catalog-dialog";
import { DeleteCatalogDialog } from "./delete-catalog-dialog";

export function CatalogList() {
  const { catalogs, isLoading } = useTradeCatalogs();
  const [selectedId, setSelectedId] = useState("");
  const [openDelete, setOpenDelete] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpenCreate(true)} className="gap-2">
          <PlusIcon className="size-4" />
          Novo catálogo
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catálogo</TableHead>
                  <TableHead className="text-center">Páginas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Link público</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Array.from({ length: 5 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!isLoading && catalogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhum catálogo criado ainda.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  catalogs.map((catalog) => (
                    <TableRow key={catalog.id}>
                      <TableCell>
                        <Link
                          href={`/trade/catalogo-pdv/${catalog.id}`}
                          className="font-medium hover:underline"
                        >
                          {catalog.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        {catalog.pagesCount}
                      </TableCell>
                      <TableCell>
                        <CatalogStatusBadge status={catalog.status} />
                      </TableCell>
                      <TableCell>
                        {catalog.isPublic ? (
                          <span className="text-sm text-emerald-600">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Desativado
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {catalog.status === "READY" && catalog.pdfKey && (
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={constructUrl(catalog.pdfKey)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <DownloadIcon className="size-4" />
                                PDF
                              </a>
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVerticalIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/trade/catalogo-pdv/${catalog.id}`}>
                                  <PencilIcon className="mr-2 size-4" />
                                  Abrir
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setSelectedId(catalog.id);
                                  setOpenDelete(true);
                                }}
                              >
                                <Trash2Icon className="mr-2 size-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateCatalogDialog open={openCreate} onOpenChange={setOpenCreate} />
      <DeleteCatalogDialog
        id={selectedId}
        open={openDelete}
        onOpenChange={setOpenDelete}
      />
    </div>
  );
}
