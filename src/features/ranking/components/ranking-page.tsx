"use client";

import { ExternalLink, Plus, Settings, Sliders, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useQueryCollaborators } from "@/features/collaborators/hooks/use-collaborators";
import { ErpSyncBadge } from "@/features/erp-sync/components/erp-sync-badge";
import {
  type SalesMode,
  useSalesGoalRanking,
  useSalesGoalRankingSettings,
} from "@/features/ranking/hooks/use-ranking";
import { useRankingSyncTop3Chime } from "@/features/ranking/hooks/use-ranking-sync-chime";
import { buildCollaboratorPhotoMap } from "@/features/ranking/lib/collaborator-name-match";
import { topRankEntryIds } from "@/features/ranking/lib/sales-goal-rank-order";
import type { SalesGoalPeriodType } from "@/features/ranking/lib/sales-goal-xlsx-parser";
import { orpc } from "@/lib/orpc";
import { hasFullAccess } from "@/lib/permissions";
import { SalesGoalAddEntryDialog } from "./sales-goal-add-entry-dialog";
import { SalesGoalImportDialog } from "./sales-goal-import-dialog";
import { SalesGoalRankingBoard } from "./sales-goal-ranking-board";
import { SalesGoalSettingsSheet } from "./sales-goal-settings-sheet";
import { SalesGoalSetupWizard } from "./sales-goal-setup-wizard";

const SALES_MODE_STORAGE_KEY = "ranking:sales-mode";

export function RankingPage() {
  const [periodType, setPeriodType] = useState<SalesGoalPeriodType>("MONTHLY");
  const [salesMode, setSalesMode] = useState<SalesMode>("INVOICED");
  const [importOpen, setImportOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);

  // Preferência do gestor entre faturado e pipeline — sobrevive a reload. Lida
  // só no cliente (efeito), para não divergir do HTML do servidor na hidratação.
  useEffect(() => {
    const saved = window.localStorage.getItem(SALES_MODE_STORAGE_KEY);
    if (saved === "INVOICED" || saved === "PIPELINE") setSalesMode(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(SALES_MODE_STORAGE_KEY, salesMode);
  }, [salesMode]);

  const query = useSalesGoalRanking(periodType, salesMode);
  const settingsQuery = useSalesGoalRankingSettings();
  const orgQuery = useQuery(orpc.org.get.queryOptions());
  const publicUrl = orgQuery.data?.organization.slug
    ? `/ranking-publico/${orgQuery.data.organization.slug}`
    : null;
  const currentMemberQuery = useQuery(
    orpc.members.getCurrent.queryOptions({ input: {} }),
  );
  const canEdit = hasFullAccess(currentMemberQuery.data?.role);
  const collaboratorsQuery = useQueryCollaborators(true);
  const collaboratorPhotoByName = useMemo(
    () => buildCollaboratorPhotoMap(collaboratorsQuery.data ?? []),
    [collaboratorsQuery.data],
  );
  const period = query.data;

  // Top 3 GLOBAL (todas as equipes), independente do filtro de time do board —
  // é "o top 3 do ranking" objetivo que o alerta de sync compara.
  const top3Ids = useMemo(() => {
    if (!period) return null;
    const all = period.branches.flatMap((branch) => branch.entries);
    if (all.length === 0) return null;
    return topRankEntryIds(all, 3);
  }, [period]);

  // Toca o áudio gravado quando um sync do ERP muda o pódio (posições 1–3).
  useRankingSyncTop3Chime({
    top3Ids,
    rankingUpdatedAt: query.dataUpdatedAt,
    volume: settingsQuery.data?.soundVolume ?? 0.6,
    enabled: settingsQuery.data?.soundEnabled ?? false,
  });

  return (
    <>
      <SalesGoalRankingBoard
        period={period}
        settings={settingsQuery.data}
        isLoading={query.isLoading}
        periodType={periodType}
        onPeriodTypeChange={setPeriodType}
        salesMode={salesMode}
        onSalesModeChange={setSalesMode}
        onRefresh={() => query.refetch()}
        canEdit={canEdit}
        photoByName={collaboratorPhotoByName}
        statusSlot={<ErpSyncBadge canEdit={canEdit} />}
        toolbarActions={
          publicUrl && (
            <Button
              variant="outline"
              size="icon-sm"
              asChild
              title="Página pública"
            >
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                <span className="sr-only">Página pública</span>
              </a>
            </Button>
          )
        }
        headerActions={
          canEdit && (
            <ButtonGroup>
              <Button
                variant="outline"
                onClick={() => setAddEntryOpen(true)}
                className="gap-2"
              >
                <Plus className="size-4" /> Adicionar meta
              </Button>
              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="gap-2"
              >
                <Upload className="size-4" /> Importar planilha
              </Button>
              <Button onClick={() => setSettingsOpen(true)} className="gap-2">
                <Settings className="size-4" /> Configurações
              </Button>
            </ButtonGroup>
          )
        }
        emptyStateActions={
          canEdit && (
            <>
              <Button onClick={() => setWizardOpen(true)} className="gap-2">
                <Sliders className="size-4" /> Configurar ranking
              </Button>
              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="gap-2"
              >
                <Upload className="size-4" /> Importar planilha
              </Button>
            </>
          )
        }
      />

      {canEdit && (
        <>
          <SalesGoalImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
          />
          <SalesGoalSetupWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            initialPeriodType={periodType}
          />
          <SalesGoalSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            currentPeriodType={periodType}
            onOpenWizard={() => {
              setSettingsOpen(false);
              setWizardOpen(true);
            }}
          />
          <SalesGoalAddEntryDialog
            open={addEntryOpen}
            onOpenChange={setAddEntryOpen}
            periodType={periodType}
            existingPeriod={period}
            existingBranchNames={(period?.branches ?? []).map(
              (branch) => branch.name,
            )}
          />
        </>
      )}
    </>
  );
}
