"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  ExternalLink,
  LayoutGrid,
  MoreVertical,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useKanbanDnd } from "../hooks/use-kanban-dnd";
import { useMutationCreateColumn } from "../hooks/use-pedidos-columns";
import { useQueryKitchenColumns } from "../hooks/use-pedidos-columns";
import {
  useQueryArchivedKitchenOrders,
  useQueryKitchenOrders,
} from "../hooks/use-pedidos";
import type { KitchenOrder } from "../hooks/use-pedidos";
import { ArchivedOrders } from "./archived-orders";
import { ColumnManager } from "./column-manager";
import { KitchenColumn } from "./pedidos-column";
import { OrderCard } from "./order-card";
import { RegisterOrderForm } from "./register-order-form";

// As 3 colunas padrão (espelham o seed do afterCreateOrganization) — usadas só
// no empty-state de orgs legadas sem backfill.
const DEFAULT_COLUMNS = [
  { name: "Em Preparo", color: "#F97316", isInitial: true, icon: "ChefHat" },
  { name: "Prontos", color: "#22C55E", showOnTv: true, icon: "BellRing" },
  { name: "Entregues", color: "#64748B", isFinal: true, icon: "CheckCheck" },
] as const;

export function KitchenBoard() {
  const { data: columns = [], isLoading: loadingColumns } =
    useQueryKitchenColumns(false);
  const { data: orders = [] } = useQueryKitchenOrders();
  const { data: archivedOrders = [] } = useQueryArchivedKitchenOrders();
  const createColumn = useMutationCreateColumn();

  // alterna a área de arquivados (botão de toggle no header)
  const [showArchived, setShowArchived] = useState(false);

  // Estado dos sheets controlados pelo header (ButtonGroup no desktop, dropdown
  // de elipse vertical no mobile). Mantidos aqui p/ um único sheet de cada,
  // acionável pelos dois layouts.
  const [managerOpen, setManagerOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  // busca livre por mesa, atendente, prato (produto) ou usuário que criou.
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    if (!normalizedSearch) return orders;
    return orders.filter((order) => {
      const haystack = [
        order.tableNumber,
        order.dishName,
        order.attendantName,
        order.createdByName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [orders, normalizedSearch]);

  // slug da org ativa p/ a URL pública da TV
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  useEffect(() => {
    authClient.organization.getFullOrganization().then(({ data }) => {
      if (data?.slug) setOrgSlug(data.slug);
    });
  }, []);

  // agrupa pedidos por columnId (a lista já vem ordenada por position).
  // Aplica o filtro de busca aqui — colunas vazias renderizam o empty-state.
  const ordersByColumn = useMemo(() => {
    const map = new Map<string, KitchenOrder[]>();
    for (const order of filteredOrders) {
      const list = map.get(order.columnId);
      if (list) list.push(order);
      else map.set(order.columnId, [order]);
    }
    return map;
  }, [filteredOrders]);

  const countIn = (columnId: string) =>
    ordersByColumn.get(columnId)?.length ?? 0;

  // coluna terminal (isFinal) — alvo da ação direta "Entregue" nos cards
  const finalColumn = columns.find((c) => c.isFinal) ?? null;

  const { activeId, activeColumnId, onDragStart, onDragCancel, onDragEnd } =
    useKanbanDnd({
      columns,
      countIn,
    });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeOrder = activeId
    ? (orders.find((o) => o.id === activeId) ?? null)
    : null;

  async function createDefaultColumns() {
    for (const column of DEFAULT_COLUMNS) {
      await createColumn.mutateAsync({ ...column });
    }
  }

  const openTvPanel = () => {
    if (orgSlug) window.open(`/painel/${orgSlug}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos">
        {/* Desktop: grupo de botões unidos. */}
        <ButtonGroup className="hidden sm:flex">
          <Button variant="outline" onClick={() => setManagerOpen(true)}>
            <Settings2 className="size-4" />
            Gerenciar
          </Button>
          <Button variant="outline" onClick={openTvPanel} disabled={!orgSlug}>
            <ExternalLink className="size-4" />
            Abrir painel da TV
          </Button>
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="size-4" />
            Novo pedido
          </Button>
        </ButtonGroup>

        {/* Mobile (sm): elipse vertical com as mesmas ações no dropdown.
            Abrimos os sheets no próximo tick (setTimeout) p/ o menu terminar de
            fechar antes — evita o pointer-events travado do Radix ao encadear
            menu → dialog. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden"
              aria-label="Ações de pedidos"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => setTimeout(() => setManagerOpen(true), 0)}
            >
              <Settings2 className="size-4" />
              Gerenciar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openTvPanel} disabled={!orgSlug}>
              <ExternalLink className="size-4" />
              Abrir painel da TV
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setTimeout(() => setRegisterOpen(true), 0)}
            >
              <Plus className="size-4" />
              Novo pedido
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sheets controlados — sem trigger próprio; acionados pelos layouts acima. */}
        <ColumnManager
          open={managerOpen}
          onOpenChange={setManagerOpen}
          showTrigger={false}
          archivedOpen={showArchived}
          onToggleArchived={() => setShowArchived((v) => !v)}
          archivedCount={archivedOrders.length}
        />
        <RegisterOrderForm
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          showTrigger={false}
        />
      </PageHeader>

      <InputGroup>
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Buscar por mesa, garçom, produto ou usuário..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Limpar busca"
              onClick={() => setSearch("")}
            >
              <X className="size-3.5" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      {loadingColumns ? (
        <div className="grid h-[calc(100vh-14rem)] grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr] xl:grid-cols-[9fr_7fr]">
          <Skeleton className="h-full w-full" />
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-1/3 w-full" />
            ))}
          </div>
        </div>
      ) : columns.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>Nenhuma coluna configurada</EmptyTitle>
            <EmptyDescription>
              Esta organização ainda não tem colunas no kanban da cozinha.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={createDefaultColumns}
              disabled={createColumn.isPending}
            >
              Criar colunas padrão
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
        >
          {/* Layout iFood: primeira coluna (entrada) à esquerda em destaque,
              demais empilhadas à direita de cima para baixo. */}
          {(() => {
            const mainColumn = columns[0];
            const sideColumns = columns.slice(1);
            const indexOf = (id: string) =>
              columns.findIndex((c) => c.id === id);
            const nextOf = (column: (typeof columns)[number]) => {
              const idx = indexOf(column.id);
              return !column.isFinal && idx < columns.length - 1
                ? columns[idx + 1]
                : null;
            };
            return (
              <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-14rem)] lg:grid-cols-[1fr_1fr] xl:grid-cols-[9fr_7fr]">
                {mainColumn && (
                  <KitchenColumn
                    key={mainColumn.id}
                    column={mainColumn}
                    orders={ordersByColumn.get(mainColumn.id) ?? []}
                    nextColumn={nextOf(mainColumn)}
                    finalColumn={finalColumn}
                    isDragActive={activeId != null}
                    activeColumnId={activeColumnId}
                    variant="main"
                  />
                )}
                <div className="flex min-h-0 flex-col gap-4">
                  {sideColumns.map((column) => (
                    <KitchenColumn
                      key={column.id}
                      column={column}
                      orders={ordersByColumn.get(column.id) ?? []}
                      nextColumn={nextOf(column)}
                      finalColumn={finalColumn}
                      isDragActive={activeId != null}
                      activeColumnId={activeColumnId}
                      variant="side"
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Fantasma do card durante o arraste. dropAnimation desativado: o
              movimento entre colunas é otimista (react-query), então o card já
              aparece na coluna nova no mesmo frame. A animação padrão voaria o
              fantasma de volta à posição original (coluna antiga) antes do
              re-render — daí o efeito de "voltar". Sem ela, a troca é instantânea. */}
          <DragOverlay dropAnimation={null}>
            {activeOrder ? (
              <OrderCard order={activeOrder} nextColumn={null} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Área de arquivados (toggle no header) */}
      {showArchived && <ArchivedOrders />}
    </div>
  );
}
