"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BookImage,
  CircleCheckBig,
  Coins,
  Map as MapIcon,
  MapPinned,
  Store,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useStoreOverview } from "../hooks/use-stores";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  hint?: string;
  accent?: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  accent,
}: StatCardProps) {
  const inner = (
    <Card
      className={cn(
        "h-full transition-colors",
        href && "hover:border-primary/50",
        accent && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            accent
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-xl font-semibold leading-tight tabular-nums">
            {value}
          </p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {hint && (
            <p className="truncate text-xs text-amber-600 dark:text-amber-400">
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function TradeMarketingOverview() {
  const { overview, isLoading } = useStoreOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-[74px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!overview) return null;

  const pendencias = overview.storesWithoutMap + overview.booksPending;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <StatCard label="Lojas" value={overview.stores} icon={Store} />
      <StatCard label="Mapas" value={overview.floorPlans} icon={MapIcon} />
      <StatCard
        label="Capturas PDV"
        value={overview.pdvPhotos}
        icon={MapPinned}
      />
      <StatCard
        label="Books"
        value={overview.books}
        icon={BookImage}
        href="/books"
        hint={
          overview.booksPending > 0
            ? `${overview.booksPending} pendente(s)`
            : undefined
        }
      />
      <StatCard
        label="Books prontos"
        value={overview.booksReady}
        icon={CircleCheckBig}
      />
      <StatCard
        label="R$ em ações"
        value={currency.format(overview.actionValueTotal)}
        icon={Coins}
      />
      {pendencias > 0 && (
        <StatCard
          label="Pendências"
          value={pendencias}
          icon={TriangleAlert}
          accent
          hint={
            overview.storesWithoutMap > 0
              ? `${overview.storesWithoutMap} loja(s) sem mapa`
              : undefined
          }
        />
      )}
    </div>
  );
}
