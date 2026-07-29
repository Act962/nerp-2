"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, Maximize2, Minimize2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { DashboardGrid } from "@/features/dashboard-widgets/components/dashboard-grid";
import { ManualMetricsAdmin } from "@/features/dashboard-widgets/components/manual-metrics-admin";
import { WidgetPickerSheet } from "@/features/dashboard-widgets/components/widget-picker-sheet";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { hasFullAccess } from "@/lib/permissions";
import { DashboardShortcuts } from "./dashboard-shortcuts";

export default function DashboardPage() {
  const { member } = useCurrentMember();
  const isAdmin = hasFullAccess(member?.role);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mesmo padrão do "Modo TV" do ranking: Fullscreen API de verdade, com
  // fallback visual (fixed inset-0) se o navegador negar (ex.: dentro de um
  // iframe sem permissão).
  useEffect(() => {
    const handleFullscreenChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await panelRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreen((current) => !current);
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className={cn(
        fullscreen
          ? "fixed inset-0 z-[60] overflow-y-auto bg-background p-6"
          : "space-y-6",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3",
          fullscreen && "mb-6",
        )}
      >
        <PageHeader
          title="Dashboard"
          description="Visão geral do seu negócio"
        />
        <div className="flex flex-wrap gap-2">
          {!fullscreen && isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMetricsOpen(true)}
            >
              <ListChecks className="size-4" /> Métricas manuais
            </Button>
          )}
          {!fullscreen && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="size-4" /> Adicionar widget
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="size-4" /> Sair da tela cheia
              </>
            ) : (
              <>
                <Maximize2 className="size-4" /> Tela cheia
              </>
            )}
          </Button>
        </div>
      </div>

      {!fullscreen && <DashboardShortcuts />}

      {/* key força remontar ao entrar/sair da tela cheia — o hook de largura
        do react-grid-layout mede via ResizeObserver no mount, e a transição
        de tela cheia (Fullscreen API ou o fallback fixed inset-0) podia
        deixar a largura medida presa no valor de antes da troca. Remontar
        garante uma medição nova contra o DOM já no tamanho final. */}
      <DashboardGrid
        key={fullscreen ? "fullscreen" : "normal"}
        fullscreen={fullscreen}
      />

      <WidgetPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
      {isAdmin && (
        <ManualMetricsAdmin open={metricsOpen} onOpenChange={setMetricsOpen} />
      )}
    </div>
  );
}
