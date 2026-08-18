import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { BookStatus } from "@/generated/prisma/enums";
import { BOOK_STATUS_META } from "../lib/book-format";

export function BookStatusBadge({ status }: { status: BookStatus }) {
  const meta = BOOK_STATUS_META[status];
  return (
    <Badge variant={meta.variant} className="gap-1">
      {status === "GENERATING" && <Spinner className="size-3" />}
      {meta.label}
    </Badge>
  );
}
