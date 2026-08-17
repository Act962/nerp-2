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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  LayoutGrid,
  List as ListIcon,
  MoreVerticalIcon,
  PencilIcon,
  Send,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useBooks } from "../hooks/use-books";
import { formatPeriod } from "../lib/book-format";
import { BookStatusBadge } from "./book-status-badge";
import { BooksGrid } from "./books-grid";
import type { BookFilter } from "./books-screen";
import { DeleteBookDialog } from "./delete-book-dialog";

const FILTER_LABEL: Record<BookFilter, string> = {
  complete: "books completos",
  incomplete: "books incompletos",
  sent: "books enviados",
};

// Mesmas definições do painel (src/app/router/book/dashboard.ts): completo é
// ter páginas e todas aprovadas; enviado é ter sentAt.
function matchesFilter(
  book: { itemsCount: number; approvedCount: number; sentAt: string | null },
  filter: BookFilter,
) {
  if (filter === "sent") return book.sentAt !== null;
  const isComplete =
    book.itemsCount > 0 && book.approvedCount === book.itemsCount;
  return filter === "complete" ? isComplete : !isComplete;
}

interface BooksListProps {
  filter: BookFilter | null;
  onClearFilter: () => void;
}

const ALL = "__all__";

export function BooksList({ filter, onClearFilter }: BooksListProps) {
  const { books: allBooks, isLoading } = useBooks();
  const [selectedId, setSelectedId] = useState("");
  const [openDelete, setOpenDelete] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [periodFilter, setPeriodFilter] = useState(ALL);
  const [supplierFilter, setSupplierFilter] = useState(ALL);
  const [storeFilter, setStoreFilter] = useState(ALL);

  // Opções derivadas dos books carregados (distintas, ordenadas). Período usa
  // a chave "ano-mês" pra ordenar cronologicamente e rotula com formatPeriod.
  const periods = [
    ...new Map(
      allBooks.map((b) => [
        `${b.periodYear}-${String(b.periodMonth).padStart(2, "0")}`,
        { month: b.periodMonth, year: b.periodYear },
      ]),
    ),
  ].sort(([a], [b]) => b.localeCompare(a));
  const suppliers = [
    ...new Set(
      allBooks
        .map((b) => b.supplierName)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const stores = [...new Set(allBooks.flatMap((b) => b.storeNames))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );

  const books = allBooks.filter((book) => {
    if (filter && !matchesFilter(book, filter)) return false;
    if (
      periodFilter !== ALL &&
      `${book.periodYear}-${String(book.periodMonth).padStart(2, "0")}` !==
        periodFilter
    )
      return false;
    if (supplierFilter !== ALL && book.supplierName !== supplierFilter)
      return false;
    if (storeFilter !== ALL && !book.storeNames.includes(storeFilter))
      return false;
    return true;
  });

  const hasExtraFilters =
    periodFilter !== ALL || supplierFilter !== ALL || storeFilter !== ALL;

  const askDelete = (id: string) => {
    setSelectedId(id);
    setOpenDelete(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Data" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as datas</SelectItem>
            {periods.map(([key, { month, year }]) => (
              <SelectItem key={key} value={key}>
                {formatPeriod(month, year)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger size="sm" className="w-[170px]">
            <SelectValue placeholder="Indústria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as indústrias</SelectItem>
            {suppliers.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger size="sm" className="w-[170px]">
            <SelectValue placeholder="Loja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as lojas</SelectItem>
            {stores.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasExtraFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setPeriodFilter(ALL);
              setSupplierFilter(ALL);
              setStoreFilter(ALL);
            }}
          >
            Limpar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {filter ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>
              Mostrando {books.length} de {allBooks.length} —{" "}
              {FILTER_LABEL[filter]}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={onClearFilter}
            >
              Limpar filtro
            </Button>
          </div>
        ) : (
          <span />
        )}
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            type="button"
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-4" /> Capas
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setView("list")}
          >
            <ListIcon className="size-4" /> Lista
          </Button>
        </div>
      </div>

      {view === "grid" && !isLoading && books.length > 0 && (
        <BooksGrid books={books} onDelete={askDelete} />
      )}
      {view === "grid" && !isLoading && books.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          {filter
            ? `Nenhum book em "${FILTER_LABEL[filter]}".`
            : "Nenhum book criado ainda."}
        </p>
      )}

      {view === "list" && (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Indústria
                    </TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="hidden text-center md:table-cell">
                      Fotos
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading &&
                    Array.from({ length: 3 }).map((_, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {Array.from({ length: 6 }).map((_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                  {!isLoading && books.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        {filter
                          ? `Nenhum book em "${FILTER_LABEL[filter]}".`
                          : "Nenhum book criado ainda."}
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading &&
                    books.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          <Link
                            href={`/books/${book.id}`}
                            className="font-medium hover:underline"
                          >
                            {book.name}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {book.supplierName ?? (
                            <span className="text-muted-foreground">Geral</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatPeriod(book.periodMonth, book.periodYear)}
                        </TableCell>
                        <TableCell className="hidden text-center md:table-cell">
                          <span>{book.itemsCount}</span>
                          {book.rejectedCount > 0 && (
                            <span className="ml-1 font-medium text-red-600">
                              ({book.rejectedCount} reprov.)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <BookStatusBadge status={book.status} />
                            {book.sentAt && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                                <Send className="size-3" /> Enviado
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {book.status === "READY" && book.pdfKey && (
                              <Button asChild variant="outline" size="sm">
                                <a
                                  href={constructUrl(book.pdfKey)}
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
                                  <Link href={`/books/${book.id}`}>
                                    <PencilIcon className="mr-2 size-4" />
                                    Abrir
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedId(book.id);
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
      )}

      <DeleteBookDialog
        id={selectedId}
        open={openDelete}
        onOpenChange={setOpenDelete}
      />
    </>
  );
}
