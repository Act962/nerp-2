"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { BookVariableValues } from "../../lib/book-variables";
import { useReorderBookPages } from "../../hooks/use-books";
import type { LayoutLogos } from "../templates/layout-preview";
import { BookPageCardV2, type BookPageV2 } from "./book-page-card-v2";

// Renderiza páginas do NOVO modelo (BookPage). Reorder por setas ↑/↓ (uma
// posição por clique) — cobre "posicionar a página extra entre as de foto".
interface BookPagesListV2Props {
  bookId: string;
  supplierId: string | null;
  pages: BookPageV2[];
  logos: LayoutLogos;
  variableValues: BookVariableValues;
}

export function BookPagesListV2({
  bookId,
  supplierId,
  pages,
  logos,
  variableValues,
}: BookPagesListV2Props) {
  const reorder = useReorderBookPages();

  // Troca a página do índice `from` com a vizinha `to` e persiste a nova ordem.
  const move = (from: number, to: number) => {
    if (to < 0 || to >= pages.length || reorder.isPending) return;
    const ids = pages.map((p) => p.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder.mutate({ bookId, orderedPageIds: ids });
  };

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma página automática ainda. Clique em "Gerar automático" na tela
          de books.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pages.map((page, index) => (
        <BookPageCardV2
          key={page.id}
          bookId={bookId}
          supplierId={supplierId}
          page={page}
          position={index + 1}
          total={pages.length}
          logos={logos}
          variableValues={variableValues}
          onMoveUp={() => move(index, index - 1)}
          onMoveDown={() => move(index, index + 1)}
          canMoveUp={index > 0}
          canMoveDown={index < pages.length - 1}
        />
      ))}
    </div>
  );
}
