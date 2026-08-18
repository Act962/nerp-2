"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Camera,
  Clock,
  MapPin,
  Route,
  Store as StoreIcon,
  Timer,
  Zap,
} from "lucide-react";
import {
  formatClock,
  formatDayTime,
  formatDuration,
} from "../lib/format-duration";
import type { PromoterTrail } from "../lib/trail-types";

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums leading-tight">
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Produtividade do promotor no período.
 *
 * Os tempos vêm do intervalo entre fotos, não de check-in — por isso a tela diz
 * de onde cada número sai. Um painel que apresenta "2h em loja" sem essa
 * ressalva vira base de cobrança para um dado que não foi medido assim.
 */
export function PromoterDetailSheet({
  trail,
  open,
  onOpenChange,
  onFocusStop,
}: {
  trail: PromoterTrail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusStop?: (point: { latitude: number; longitude: number }) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {trail && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-base">
                {trail.image ? (
                  // biome-ignore lint/performance/noImgElement: avatar de URL do R2
                  <img
                    src={trail.image}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {trail.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                )}
                {trail.name}
              </SheetTitle>
              <SheetDescription>
                {trail.firstAt && trail.lastAt
                  ? `${formatDayTime(trail.firstAt)} → ${formatDayTime(trail.lastAt)}`
                  : "Sem registro no período"}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-8">
              <div className="grid grid-cols-2 gap-2">
                <Metric
                  icon={<StoreIcon className="size-3.5" />}
                  label="Clientes visitados"
                  value={String(trail.storeCount)}
                  hint={`${trail.points.length} parada(s)`}
                />
                <Metric
                  icon={<Zap className="size-3.5" />}
                  label="Ativações"
                  value={String(trail.activationCount)}
                />
                <Metric
                  icon={<Camera className="size-3.5" />}
                  label="Fotos"
                  value={String(trail.imageCount)}
                />
                <Metric
                  icon={<Clock className="size-3.5" />}
                  label="Tempo em loja"
                  value={formatDuration(trail.activeMs)}
                  hint={
                    trail.unmeasuredStops > 0
                      ? `${trail.unmeasuredStops} parada(s) não medida(s)`
                      : undefined
                  }
                />
                <Metric
                  icon={<Timer className="size-3.5" />}
                  label="Média por visita"
                  value={
                    trail.measuredStops > 0
                      ? formatDuration(trail.avgVisitMs)
                      : "—"
                  }
                  hint={
                    trail.measuredStops > 0
                      ? `${trail.measuredStops} visita(s) medida(s)`
                      : "nenhuma visita medida"
                  }
                />
                <Metric
                  icon={<Route className="size-3.5" />}
                  label="Deslocamento"
                  value={formatDuration(trail.travelMs)}
                />
              </div>

              {trail.idleMs > 0 && (
                <p className="text-xs text-muted-foreground">
                  Fora disso, {formatDuration(trail.idleMs)} em intervalos
                  longos — almoço, fim de expediente ou virada de dia. Não
                  entram como deslocamento.
                </p>
              )}

              {/* A ressalva não é rodapé decorativo: "tempo em loja" aqui é o
                intervalo entre a primeira e a última foto da visita. Numa
                parada de foto única esse intervalo é zero medido, não zero
                real. */}
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Como estes números são calculados
                </p>
                <p className="mt-1">
                  <strong>Tempo em loja</strong> é o intervalo entre a primeira
                  e a última foto de cada visita — quem tirou uma foto só
                  aparece com zero, o que significa "não medido", não "não
                  trabalhou". A <strong>média por visita</strong> divide só
                  pelas visitas medidas, pelo mesmo motivo.
                </p>
                <p className="mt-1">
                  <strong>Ativação</strong> é uma captura registrada em loja;
                  cada uma leva de 1 a 3 <strong>fotos</strong>. Por isso os
                  dois números são diferentes.
                </p>
                <p className="mt-1">
                  <strong>Deslocamento</strong> é o intervalo entre sair de uma
                  loja e a primeira foto na próxima. Acima de 3 horas vira
                  intervalo, não deslocamento.
                </p>
              </div>

              {trail.byStore.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Por cliente</p>
                  <ul className="divide-y rounded-lg border">
                    {trail.byStore.map((visit) => (
                      <li key={visit.storeId} className="p-2.5">
                        <p className="truncate text-sm font-medium">
                          {visit.storeName ?? "Sem loja"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {visit.visits} visita(s) · {visit.activationCount}{" "}
                          ativação(ões) · {visit.imageCount} foto(s)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(visit.activeMs)} em loja
                          {visit.measuredVisits > 0 ? (
                            <> · média {formatDuration(visit.avgVisitMs)}</>
                          ) : (
                            " · tempo não medido"
                          )}
                          {" · "}
                          {formatDayTime(visit.lastAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm font-medium">Paradas</p>
                <ol className="space-y-1">
                  {trail.points.map((stop, index) => (
                    <li key={stop.id}>
                      <button
                        type="button"
                        onClick={() =>
                          onFocusStop?.({
                            latitude: stop.latitude,
                            longitude: stop.longitude,
                          })
                        }
                        className="flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {stop.storeName ?? "Sem loja"}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatClock(stop.at)}
                            {stop.endAt && `–${formatClock(stop.endAt)}`}
                            {" · "}
                            {stop.activationCount} ativação(ões) ·{" "}
                            {stop.imageCount} foto(s)
                            {stop.endAt && (
                              <>
                                {" · "}
                                {formatDuration(
                                  new Date(stop.endAt).getTime() -
                                    new Date(stop.at).getTime(),
                                )}
                              </>
                            )}
                          </span>
                          {stop.gapFromPreviousMs !== null &&
                            !stop.startsNewSegment && (
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="size-3" />
                                {formatDuration(stop.gapFromPreviousMs)} desde a
                                parada anterior
                              </span>
                            )}
                        </span>
                        {stop.startsNewSegment && index > 0 && (
                          <Badge variant="secondary" className="shrink-0">
                            retomada
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
