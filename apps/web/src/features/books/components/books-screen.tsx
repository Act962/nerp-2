"use client";

import { PhotosForApprovalList } from "@/features/promotor/components/photos-for-approval";
import type { PromotorPhotoStatus } from "@/features/promotor/hooks/use-promotor";
import { useMemo, useState } from "react";
import { useBooks } from "../hooks/use-books";
import { BooksDashboard } from "./books-dashboard";
import { BooksList } from "./books-list";

export type BookFilter = "complete" | "incomplete" | "sent";
export const ALL_FILTER = "__all__";

// Dono do estado compartilhado entre o painel e as duas listas: os cards do
// dashboard são filtros (clique), e os filtros Data/Indústria/Loja da lista
// agora também alimentam os 3 indicadores de book — por isso vivem aqui.
export function BooksScreen() {
  const { books: allBooks } = useBooks();
  const [bookFilter, setBookFilter] = useState<BookFilter | null>(null);
  const [photoFilter, setPhotoFilter] = useState<PromotorPhotoStatus | null>(
    null,
  );
  // Filtros da barra da lista (Data/Indústria/Loja) — escopo dos indicadores.
  const [periodFilter, setPeriodFilter] = useState(ALL_FILTER);
  const [supplierFilter, setSupplierFilter] = useState(ALL_FILTER);
  const [storeFilter, setStoreFilter] = useState(ALL_FILTER);

  // Books no escopo dos filtros (NÃO aplica o filtro de card, que é dos cards).
  const scopedBooks = useMemo(
    () =>
      allBooks.filter((b) => {
        if (
          periodFilter !== ALL_FILTER &&
          `${b.periodYear}-${String(b.periodMonth).padStart(2, "0")}` !==
            periodFilter
        )
          return false;
        if (supplierFilter !== ALL_FILTER && b.supplierName !== supplierFilter)
          return false;
        if (storeFilter !== ALL_FILTER && !b.storeNames.includes(storeFilter))
          return false;
        return true;
      }),
    [allBooks, periodFilter, supplierFilter, storeFilter],
  );

  // Mesma definição da lista/painel: completo = tem itens e todos aprovados;
  // enviado = tem sentAt. Assim os indicadores batem com a lista filtrada.
  const bookCounts = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let sent = 0;
    for (const b of scopedBooks) {
      if (b.itemsCount > 0 && b.approvedCount === b.itemsCount) complete++;
      else incomplete++;
      if (b.sentAt !== null) sent++;
    }
    return { complete, incomplete, sent };
  }, [scopedBooks]);

  return (
    <div className="space-y-4">
      <BooksDashboard
        bookFilter={bookFilter}
        onBookFilterChange={setBookFilter}
        photoFilter={photoFilter}
        onPhotoFilterChange={setPhotoFilter}
        bookCounts={bookCounts}
      />

      {photoFilter && (
        <PhotosForApprovalList
          status={photoFilter}
          onStatusChange={setPhotoFilter}
        />
      )}

      <BooksList
        filter={bookFilter}
        onClearFilter={() => setBookFilter(null)}
        periodFilter={periodFilter}
        onPeriodChange={setPeriodFilter}
        supplierFilter={supplierFilter}
        onSupplierChange={setSupplierFilter}
        storeFilter={storeFilter}
        onStoreChange={setStoreFilter}
      />
    </div>
  );
}
