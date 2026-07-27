import { BookEditor } from "@/features/books/components/book-editor";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  await requireTradeAccess("books");
  const { bookId } = await params;

  return <BookEditor bookId={bookId} />;
}
