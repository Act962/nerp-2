import { PageHeader } from "@/components/page-header";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { AddBookButton } from "@/features/books/components/add-book-button";
import { BooksScreen } from "@/features/books/components/books-screen";

export default async function BooksPage() {
  await requireTradeAccess("books");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Books"
        description="Monte relatórios fotográficos em PDF para enviar à indústria"
      >
        <AddBookButton />
      </PageHeader>
      <BooksScreen />
    </div>
  );
}
