"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart3,
  BookImage,
  Camera,
  ChevronRight,
  GripVertical,
  Handshake,
  LayoutGrid,
  Library,
  MapPinned,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTradeDashboard } from "../hooks/use-trade-dashboard";
import { ExpiringNegotiationsDialog } from "./expiring-negotiations-dialog";
import { SectionChart } from "./section-chart";

type Tone = "neutral" | "positive" | "negative" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-600",
  negative: "text-red-600",
  brand: "text-cyan-600",
};

interface Stat {
  label: string;
  value: number;
  tone?: Tone;
  format?: "currency";
  // Quando presente, o card vira botão e abre um detalhamento (ex.: "Próximo
  // do vencimento" abre a lista filtrável por dias/meses/anos).
  onClick?: () => void;
}

interface SectionDef {
  id: string;
  title: string;
  icon: LucideIcon;
  href: string;
  stats: Stat[];
}

const ORDER_KEY = "trade-dashboard-order-v1";
const VIEW_KEY = "trade-dashboard-view-v1";

// Negociações primeiro por padrão; o usuário reordena por drag-and-drop.
const DEFAULT_ORDER = [
  "negociacoes",
  "lojas",
  "promotor",
  "books",
  "cadastros",
  "catalogo",
  "planograma",
];

function formatValue(stat: Stat) {
  if (stat.format === "currency") {
    return stat.value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return stat.value.toLocaleString("pt-BR");
}

function StatCard({ stat, isLoading }: { stat: Stat; isLoading: boolean }) {
  const clickable = Boolean(stat.onClick);
  return (
    <Card
      onClick={stat.onClick}
      className={
        clickable
          ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/50"
          : undefined
      }
    >
      <CardContent className="flex flex-col gap-0.5 p-4">
        {isLoading ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <span
            className={`font-semibold text-2xl tabular-nums ${TONE_CLASS[stat.tone ?? "neutral"]}`}
          >
            {formatValue(stat)}
          </span>
        )}
        <span className="flex items-center gap-1 text-muted-foreground text-xs leading-tight">
          {stat.label}
          {clickable && <ChevronRight className="size-3" />}
        </span>
      </CardContent>
    </Card>
  );
}

function SortableSection({
  section,
  view,
  isLoading,
}: {
  section: SectionDef;
  view: "cards" | "charts";
  isLoading: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });
  const Icon = section.icon;

  // Barras só para contagens simples; moeda e cards clicáveis viram números
  // (escala/interação diferentes de uma barra de magnitude).
  const chartData = section.stats
    .filter((stat) => stat.format !== "currency" && !stat.onClick)
    .map((stat) => ({ label: stat.label, value: stat.value }));
  const figureStats = section.stats.filter(
    (stat) => stat.format === "currency" || stat.onClick,
  );

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-3 rounded-xl border bg-card/40 p-3 ${isDragging ? "opacity-70 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label="Reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Icon className="size-4 text-muted-foreground" />
        <Link
          href={section.href}
          className="font-medium text-sm hover:underline"
        >
          {section.title}
        </Link>
      </div>

      {view === "cards" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {section.stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} isLoading={isLoading} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {figureStats.length > 0 && (
            <div className="flex flex-wrap gap-6">
              {figureStats.map((stat) => {
                const clickable = Boolean(stat.onClick);
                return (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={stat.onClick}
                    disabled={!clickable}
                    className={`flex flex-col text-left ${clickable ? "rounded-md hover:opacity-80" : "cursor-default"}`}
                  >
                    <span
                      className={`font-semibold text-xl tabular-nums ${TONE_CLASS[stat.tone ?? "neutral"]}`}
                    >
                      {formatValue(stat)}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      {stat.label}
                      {clickable && <ChevronRight className="size-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {chartData.length > 0 && <SectionChart data={chartData} />}
        </div>
      )}
    </section>
  );
}

export function TradeDashboard() {
  const { data, isLoading } = useTradeDashboard();
  const value = (key: keyof NonNullable<typeof data>) => data?.[key] ?? 0;

  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [view, setView] = useState<"cards" | "charts">("cards");
  const [expiringOpen, setExpiringOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  // Preferências pessoais: ordem das seções e modo de visualização.
  useEffect(() => {
    const storedOrder = localStorage.getItem(ORDER_KEY);
    if (storedOrder) {
      try {
        const parsed = JSON.parse(storedOrder) as string[];
        // Mantém só ids conhecidos e adiciona seções novas no fim.
        const known = parsed.filter((id) => DEFAULT_ORDER.includes(id));
        const missing = DEFAULT_ORDER.filter((id) => !known.includes(id));
        setOrder([...known, ...missing]);
      } catch {
        // ignora ordem corrompida
      }
    }
    const storedView = localStorage.getItem(VIEW_KEY);
    if (storedView === "charts" || storedView === "cards") setView(storedView);
  }, []);

  const persistOrder = (next: string[]) => {
    setOrder(next);
    localStorage.setItem(ORDER_KEY, JSON.stringify(next));
  };
  const persistView = (next: "cards" | "charts") => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as string);
    const to = order.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    persistOrder(arrayMove(order, from, to));
  };

  const sections: Record<string, SectionDef> = {
    negociacoes: {
      id: "negociacoes",
      title: "Negociações",
      icon: Handshake,
      href: "/lojas",
      stats: [
        { label: "Negociações", value: value("negotiations") },
        {
          label: "Fechadas vigentes",
          value: value("negotiationsClosed"),
          tone: "positive",
        },
        {
          label: "Próximo do vencimento",
          value: value("negotiationsExpiringSoon"),
          tone: "negative",
          onClick: () => setExpiringOpen(true),
        },
        {
          label: "Interesses novos (TradeGram)",
          value: value("interestsNew"),
          tone: "brand",
        },
        {
          label: "Valor negociado",
          value: value("negotiatedValue"),
          tone: "brand",
          format: "currency",
        },
      ],
    },
    lojas: {
      id: "lojas",
      title: "Lojas e Mapas",
      icon: MapPinned,
      href: "/lojas",
      stats: [
        { label: "Lojas", value: value("stores") },
        {
          label: "Lojas sem mapa",
          value: value("storesWithoutMap"),
          tone: "negative",
        },
        { label: "Plantas", value: value("floorPlans") },
        {
          label: "Espaços mapeados",
          value: value("espacosTotal"),
          tone: "brand",
        },
        { label: "Espaços livres", value: value("espacosLivre") },
        {
          label: "Executados",
          value: value("espacosExecutado"),
          tone: "positive",
        },
        {
          label: "Pendentes",
          value: value("espacosPendente"),
          tone: "negative",
        },
        { label: "Checkouts", value: value("checkouts") },
      ],
    },
    promotor: {
      id: "promotor",
      title: "Promotor e Fotos",
      icon: Camera,
      href: "/promotor",
      stats: [
        { label: "Fotos de PDV", value: value("pdvPhotos") },
        { label: "Aguardando aprovação", value: value("photosPending") },
        {
          label: "Aprovadas",
          value: value("photosApproved"),
          tone: "positive",
        },
        {
          label: "Reprovadas",
          value: value("photosRejected"),
          tone: "negative",
        },
        { label: "Promotores vinculados", value: value("promoters") },
      ],
    },
    books: {
      id: "books",
      title: "Books de PDV",
      icon: BookImage,
      href: "/books",
      stats: [
        { label: "Books", value: value("books") },
        { label: "Enviados", value: value("booksSent"), tone: "positive" },
        { label: "Prontos (PDF)", value: value("booksReady") },
      ],
    },
    cadastros: {
      id: "cadastros",
      title: "Cadastros de Trade",
      icon: Library,
      href: "/trade/cadastros",
      stats: [
        { label: "Indústrias", value: value("suppliers") },
        { label: "Marcas", value: value("brands") },
        { label: "Tipos de mídia", value: value("mediaTypes") },
        { label: "Tipos de negociação", value: value("negotiationTypes") },
        { label: "Setores", value: value("storeSectors") },
      ],
    },
    catalogo: {
      id: "catalogo",
      title: "Catálogo PDV",
      icon: Tag,
      href: "/trade/catalogo-pdv",
      stats: [
        { label: "Catálogos", value: value("tradeCatalogs") },
        { label: "Páginas", value: value("tradeCatalogPages") },
      ],
    },
    planograma: {
      id: "planograma",
      title: "Planograma",
      icon: LayoutGrid,
      href: "/trade/planograma",
      stats: [
        { label: "Planogramas", value: value("planograms") },
        {
          label: "Ativos",
          value: value("planogramsActive"),
          tone: "positive",
        },
        { label: "Itens posicionados", value: value("planogramItems") },
      ],
    },
  };

  const ordered = order.map((id) => sections[id]).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Arraste pelo <GripVertical className="inline size-3" /> para
          reordenar.
        </p>
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "cards" ? "secondary" : "ghost"}
            className="h-8 gap-1.5"
            onClick={() => persistView("cards")}
          >
            <LayoutGrid className="size-4" /> Cards
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "charts" ? "secondary" : "ghost"}
            className="h-8 gap-1.5"
            onClick={() => persistView("charts")}
          >
            <BarChart3 className="size-4" /> Gráficos
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {ordered.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                view={view}
                isLoading={isLoading}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ExpiringNegotiationsDialog
        open={expiringOpen}
        onOpenChange={setExpiringOpen}
      />
    </div>
  );
}
