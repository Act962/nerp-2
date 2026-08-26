"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ChartPie, Trophy, UserX } from "lucide-react";
import { useBookApprovalInsights } from "../hooks/use-books";

// Paleta categórica que lê bem no claro e no escuro.
const DONUT_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#14b8a6",
  "#e11d48",
];

function CardHead({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof ChartPie;
}) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <Icon className="size-4" />
    </div>
  );
}

// Doughnut da distribuição por tipo de mídia + legenda.
export function MediaTypeDonutCard({ supplierId }: { supplierId?: string }) {
  const { mediaDistribution } = useBookApprovalInsights(supplierId);
  const total = mediaDistribution.reduce((sum, m) => sum + m.count, 0);

  let cumulative = 0;
  const segments = mediaDistribution.map((m, i) => {
    const pct = total ? (m.count / total) * 100 : 0;
    const offset = 25 - cumulative;
    cumulative += pct;
    return {
      key: `${m.mediaTypeId ?? "none"}-${i}`,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      dash: `${pct.toFixed(2)} ${(100 - pct).toFixed(2)}`,
      offset: offset.toFixed(2),
      code: m.code,
      name: m.name,
      count: m.count,
    };
  });

  return (
    <Card className="col-span-2">
      <CardContent className="p-4">
        <CardHead title="Tipos de mídias" icon={ChartPie} />
        <div className="mt-3 flex items-center gap-4">
          <div className="relative size-[88px] shrink-0">
            <svg viewBox="0 0 42 42" className="size-[88px]" role="img">
              <title>Distribuição de fotos por tipo de mídia</title>
              <circle
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                className="stroke-muted"
                strokeWidth="5.5"
              />
              {segments.map((s) => (
                <circle
                  key={s.key}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="5.5"
                  strokeDasharray={s.dash}
                  strokeDashoffset={s.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold leading-none tabular-nums">
                {total}
              </span>
              <span className="text-[9px] text-muted-foreground">fotos</span>
            </div>
          </div>
          {/* Mostra ~6 (2 col × 3 linhas); o resto rola. */}
          <div className="grid max-h-[76px] min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto pr-1">
            {segments.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Nenhuma foto categorizada ainda.
              </span>
            ) : (
              segments.map((s) => (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: s.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {s.code} · {s.name}
                  </span>
                  <span className="font-bold tabular-nums">{s.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Promotores (membros com carimbo) que não têm foto aprovada no período.
export function PromotersWithoutPhotosCard({
  supplierId,
}: {
  supplierId?: string;
}) {
  const { promotersWithoutPhotos } = useBookApprovalInsights(supplierId);
  const { total, names } = promotersWithoutPhotos;

  return (
    <Card className="col-span-2">
      <CardContent className="p-4">
        <CardHead title="Promotores sem fotos" icon={UserX} />
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-red-600">
            {names.length}
          </span>
          <span className="text-xs leading-tight text-muted-foreground">
            de {total} promotor(es) não enviaram foto no período
          </span>
        </div>
        {names.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {names.slice(0, 8).map((n) => (
              <span
                key={n}
                className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-600"
              >
                {n}
              </span>
            ))}
            {names.length > 8 && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                +{names.length - 8}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2.5 text-xs text-muted-foreground">
            {total > 0
              ? "Todos os promotores enviaram fotos."
              : "Nenhum promotor marcado para o carimbo."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Ranking de promotores por nº de fotos aprovadas (mini-barras).
export function PromoterRankingCard({ supplierId }: { supplierId?: string }) {
  const { promoterRanking } = useBookApprovalInsights(supplierId);
  const max = Math.max(1, ...promoterRanking.map((p) => p.count));

  return (
    <Card className="col-span-2">
      <CardContent className="p-4">
        <CardHead title="Ranking de promotor" icon={Trophy} />
        <div className="mt-3 flex flex-col gap-2.5">
          {promoterRanking.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Sem fotos aprovadas no período.
            </span>
          ) : (
            promoterRanking.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2.5 text-xs">
                <span
                  className={`grid size-[19px] shrink-0 place-items-center rounded-md text-[11px] font-bold ${
                    i === 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="w-24 shrink-0 truncate font-semibold">
                  {p.name}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(p.count / max) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right font-bold tabular-nums text-muted-foreground">
                  {p.count}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
