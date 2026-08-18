"use client";

import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import type { PromotorPhotoStatus } from "@/features/promotor/hooks/use-promotor";
import { memberCan } from "@/lib/permissions";
import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useBookDashboard } from "../hooks/use-books";
import type { BookFilter } from "./books-screen";

interface Metric {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "neutral" | "positive" | "negative";
  onClick: () => void;
  isActive: boolean;
  badge?: number;
}

const TONE_CLASS: Record<Metric["tone"], string> = {
  neutral: "text-muted-foreground",
  positive: "text-emerald-600",
  negative: "text-red-600",
};

function CardBody({ card, isLoading }: { card: Metric; isLoading: boolean }) {
  return (
    <CardContent className="flex flex-col gap-1 p-4">
      <div className="flex items-center justify-between">
        <card.icon className={`size-5 ${TONE_CLASS[card.tone]}`} />
        {!!card.badge && card.badge > 0 && (
          <span className="rounded-full bg-amber-500 px-1.5 font-semibold text-white text-xs">
            {card.badge}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="mt-1 h-7 w-10" />
      ) : (
        <span className="font-semibold text-2xl tabular-nums">
          {card.value}
        </span>
      )}
      <span className="text-muted-foreground text-xs leading-tight">
        {card.label}
      </span>
    </CardContent>
  );
}

interface BooksDashboardProps {
  bookFilter: BookFilter | null;
  onBookFilterChange: (filter: BookFilter | null) => void;
  photoFilter: PromotorPhotoStatus | null;
  onPhotoFilterChange: (filter: PromotorPhotoStatus | null) => void;
}

export function BooksDashboard({
  bookFilter,
  onBookFilterChange,
  photoFilter,
  onPhotoFilterChange,
}: BooksDashboardProps) {
  const { metrics, isLoading } = useBookDashboard();
  const { member, isLoading: isMemberLoading } = useCurrentMember();
  // Enquanto o member não resolve (ou a consulta falha) mantemos os cards de
  // aprovação: quem gateia de fato é o servidor, com FORBIDDEN. Sem isso a
  // feature sumia sem nenhum aviso quando a consulta de membership falhava.
  const canApprove =
    isMemberLoading || !member || memberCan(member, "books-aprovar");

  // Clicar de novo no card ativo limpa o filtro — evita o usuário ficar preso
  // numa visão filtrada sem um "limpar" óbvio.
  const toggleBook = (filter: BookFilter) => () =>
    onBookFilterChange(bookFilter === filter ? null : filter);
  const togglePhoto = (filter: PromotorPhotoStatus) => () =>
    onPhotoFilterChange(photoFilter === filter ? null : filter);

  const cards: Metric[] = [
    {
      label: "Books completos",
      value: metrics?.booksComplete ?? 0,
      icon: CheckCircle2,
      tone: "positive",
      onClick: toggleBook("complete"),
      isActive: bookFilter === "complete",
    },
    {
      label: "Books incompletos",
      value: metrics?.booksIncomplete ?? 0,
      icon: CircleDashed,
      tone: "neutral",
      onClick: toggleBook("incomplete"),
      isActive: bookFilter === "incomplete",
    },
    {
      label: "Fotos para aprovação",
      value: metrics?.photosPending ?? 0,
      icon: ClipboardCheck,
      tone: "neutral",
      onClick: togglePhoto("PENDING"),
      isActive: photoFilter === "PENDING",
      badge: metrics?.photosPending ?? 0,
    },
    {
      label: "Fotos aprovadas",
      value: metrics?.photosApproved ?? 0,
      icon: ThumbsUp,
      tone: "positive",
      onClick: togglePhoto("APPROVED"),
      isActive: photoFilter === "APPROVED",
    },
    {
      label: "Fotos reprovadas",
      value: metrics?.photosRejected ?? 0,
      icon: ThumbsDown,
      tone: "negative",
      onClick: togglePhoto("REJECTED"),
      isActive: photoFilter === "REJECTED",
    },
    {
      label: "Books enviados",
      value: metrics?.booksSent ?? 0,
      icon: Send,
      tone: "neutral",
      onClick: toggleBook("sent"),
      isActive: bookFilter === "sent",
    },
  ];

  // Sem permissão de aprovar, os três cards de fotos viram indicadores simples.
  const visibleCards = canApprove
    ? cards
    : cards.filter((card) => !card.label.startsWith("Fotos"));

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {visibleCards.map((card) => (
        <button
          key={card.label}
          type="button"
          onClick={card.onClick}
          aria-pressed={card.isActive}
          className={`rounded-xl border bg-card text-left shadow-sm transition-colors hover:border-primary ${
            card.isActive ? "border-primary ring-1 ring-primary" : ""
          }`}
        >
          <CardBody card={card} isLoading={isLoading} />
        </button>
      ))}
    </div>
  );
}
