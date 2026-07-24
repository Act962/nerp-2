"use client";

import { PhotosForApprovalList } from "@/features/promotor/components/photos-for-approval";
import type { PromotorPhotoStatus } from "@/features/promotor/hooks/use-promotor";
import { useState } from "react";
import { BooksDashboard } from "./books-dashboard";
import { BooksList } from "./books-list";

export type BookFilter = "complete" | "incomplete" | "sent";

// Dono do estado compartilhado entre o painel e as duas listas: os cards do
// dashboard são filtros, então precisam viver acima de quem eles filtram.
export function BooksScreen() {
  const [bookFilter, setBookFilter] = useState<BookFilter | null>(null);
  const [photoFilter, setPhotoFilter] = useState<PromotorPhotoStatus | null>(
    null,
  );

  return (
    <div className="space-y-4">
      <BooksDashboard
        bookFilter={bookFilter}
        onBookFilterChange={setBookFilter}
        photoFilter={photoFilter}
        onPhotoFilterChange={setPhotoFilter}
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
      />
    </div>
  );
}
