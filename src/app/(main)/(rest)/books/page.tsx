import { PageHeader } from "@/components/page-header";
import { AddBookButton } from "@/features/books/components/add-book-button";
import { BooksScreen } from "@/features/books/components/books-screen";
import { requirePermission } from "@/lib/auth-utils";

export default async function BooksPage() {
  await requirePermission("books");

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
