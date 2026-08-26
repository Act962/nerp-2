"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotosForApprovalList } from "@/features/promotor/components/photos-for-approval";
import type { PromotorPhotoStatus } from "@/features/promotor/hooks/use-promotor";
import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useBookDashboard, useBooks } from "../hooks/use-books";
import { BooksList } from "./books-list";
import {
  MediaTypeDonutCard,
  PromoterRankingCard,
  PromotersWithoutPhotosCard,
} from "./books-insight-cards";

export type BookFilter = "complete" | "incomplete" | "sent";
export const ALL_FILTER = "__all__";

// Card de indicador. Clicável quando `onClick` — vira filtro; senão, leitura.
function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  active,
  badge,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "neutral" | "good" | "bad";
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-red-600"
        : "text-muted-foreground";
  const valClass =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "";
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <Icon className={`size-5 ${toneClass}`} />
        {!!badge && badge > 0 && (
          <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${valClass}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs leading-tight text-muted-foreground">
        {label}
      </div>
    </>
  );
  const base =
    "rounded-xl border bg-card p-4 text-left shadow-sm transition-colors";
  if (!onClick) return <div className={base}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} hover:border-primary ${active ? "border-primary ring-1 ring-primary" : ""}`}
    >
      {inner}
    </button>
  );
}

export function BooksScreen() {
  const { books: allBooks } = useBooks();
  const { metrics } = useBookDashboard();
  const [bookFilter, setBookFilter] = useState<BookFilter | null>(null);
  const [photoStatus, setPhotoStatus] =
    useState<PromotorPhotoStatus>("PENDING");
  const [periodFilter, setPeriodFilter] = useState(ALL_FILTER);
  const [supplierFilter, setSupplierFilter] = useState(ALL_FILTER);
  const [storeFilter, setStoreFilter] = useState(ALL_FILTER);

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

  const setStatus = (s: PromotorPhotoStatus) => () =>
    setPhotoStatus((cur) => (cur === s ? "ALL" : s));

  return (
    <Tabs defaultValue="approval" className="space-y-4">
      <TabsList>
        <TabsTrigger value="approval">Aprovação de fotos</TabsTrigger>
        <TabsTrigger value="books">Books</TabsTrigger>
      </TabsList>

      {/* ---- Aprovação de fotos ---- */}
      <TabsContent value="approval" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <StatCard
            label="Para aprovação"
            value={metrics?.photosPending ?? 0}
            icon={ClipboardCheck}
            badge={metrics?.photosPending ?? 0}
            active={photoStatus === "PENDING"}
            onClick={setStatus("PENDING")}
          />
          <MediaTypeDonutCard />
          <StatCard
            label="Aprovadas"
            value={metrics?.photosApproved ?? 0}
            icon={ThumbsUp}
            tone="good"
            active={photoStatus === "APPROVED"}
            onClick={setStatus("APPROVED")}
          />
          <StatCard
            label="Reprovadas"
            value={metrics?.photosRejected ?? 0}
            icon={ThumbsDown}
            tone="bad"
            active={photoStatus === "REJECTED"}
            onClick={setStatus("REJECTED")}
          />
          <PromoterRankingCard />
          <PromotersWithoutPhotosCard />
        </div>

        <PhotosForApprovalList
          status={photoStatus}
          onStatusChange={(s) => setPhotoStatus(s)}
        />
      </TabsContent>

      {/* ---- Books ---- */}
      <TabsContent value="books" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard
            label="Books completos"
            value={bookCounts.complete}
            icon={CheckCircle2}
            tone="good"
            active={bookFilter === "complete"}
            onClick={() =>
              setBookFilter((f) => (f === "complete" ? null : "complete"))
            }
          />
          <StatCard
            label="Em montagem"
            value={bookCounts.incomplete}
            icon={CircleDashed}
            active={bookFilter === "incomplete"}
            onClick={() =>
              setBookFilter((f) => (f === "incomplete" ? null : "incomplete"))
            }
          />
          <StatCard
            label="Enviados à indústria"
            value={bookCounts.sent}
            icon={Send}
            active={bookFilter === "sent"}
            onClick={() => setBookFilter((f) => (f === "sent" ? null : "sent"))}
          />
        </div>

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
      </TabsContent>
    </Tabs>
  );
}
