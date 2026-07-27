"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  DownloadIcon,
  MoreVerticalIcon,
  PencilIcon,
  Send,
  Trash2Icon,
} from "lucide-react";
import type { BookStatus } from "@/generated/prisma/enums";
import Link from "next/link";
import { formatPeriod } from "../lib/book-format";
import {
  DEFAULT_COVER_BACKGROUND,
  buildDefaultCoverLayout,
} from "../lib/cover-layout";
import { BookStatusBadge } from "./book-status-badge";
import { LayoutPreview } from "./templates/layout-preview";

interface BookCard {
  id: string;
  name: string;
  periodMonth: number;
  periodYear: number;
  status: BookStatus;
  pdfKey: string | null;
  sentAt: string | null;
  supplierName: string | null;
  itemsCount: number;
  rejectedCount: number;
  coverLayout: unknown;
  coverBackground: unknown;
  organizationLogo: string | null;
  supplierLogo: string | null;
}

export function BooksGrid({
  books,
  onDelete,
}: {
  books: BookCard[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {books.map((book) => (
        <div
          key={book.id}
          className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
        >
          <Link href={`/books/${book.id}`} className="block border-b bg-muted">
            <LayoutPreview
              layout={
                Array.isArray(book.coverLayout)
                  ? book.coverLayout
                  : buildDefaultCoverLayout()
              }
              background={book.coverBackground ?? DEFAULT_COVER_BACKGROUND}
              variableValues={{
                nomeBook: book.name,
                periodo: formatPeriod(book.periodMonth, book.periodYear),
                industria: book.supplierName,
              }}
              logos={{
                organization: book.organizationLogo,
                supplier: book.supplierLogo,
              }}
            />
          </Link>

          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/books/${book.id}`}
                  className="line-clamp-1 font-medium hover:underline"
                >
                  {book.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {book.supplierName ?? "Geral"} ·{" "}
                  {formatPeriod(book.periodMonth, book.periodYear)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                  >
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
                  {book.status === "READY" && book.pdfKey && (
                    <DropdownMenuItem asChild>
                      <a
                        href={constructUrl(book.pdfKey)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <DownloadIcon className="mr-2 size-4" />
                        Baixar PDF
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(book.id)}
                  >
                    <Trash2Icon className="mr-2 size-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-1.5">
              <BookStatusBadge status={book.status} />
              {book.sentAt && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  <Send className="size-3" /> Enviado
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {book.itemsCount} foto(s)
              </span>
              {book.rejectedCount > 0 && (
                <span className="text-xs font-medium text-red-600">
                  {book.rejectedCount} reprov.
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
