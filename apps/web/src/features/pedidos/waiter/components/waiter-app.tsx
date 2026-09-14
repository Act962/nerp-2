"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-elapsed";
import {
  ClipboardList,
  LayoutGrid,
  Loader2,
  Plus,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useWaiterDeliverOrder,
  useWaiterOrders,
} from "../hooks/use-waiter-pedidos";
import { useWaiterSession } from "../hooks/use-waiter-session";
import {
  countTabs,
  filterByTab,
  type Tab,
  type WaiterOrder,
} from "../utils/categorize";
import { Salao } from "../mesas/salao";
import { IdentityPicker } from "./identity-picker";
import { OrderQrDialog } from "./order-qr-dialog";
import { WaiterOrderCard } from "./waiter-order-card";
import { WaiterRegisterSheet } from "./waiter-register-sheet";
import { WaiterShell } from "./waiter-shell";
import { WaiterTabs } from "./waiter-tabs";

interface Props {
  orgSlug: string;
}

/**
 * Duas seções, não cinco abas.
 *
 * O garçom abre o app para ATENDER — ver o salão e lançar pedido. Acompanhar o
 * que já está na cozinha é a segunda tarefa, não a primeira, e era ela que
 * ocupava a tela inteira antes.
 */
type Secao = "mesas" | "pedidos";

export function WaiterApp({ orgSlug }: Props) {
  const { identity, hydrated, save, clear } = useWaiterSession(orgSlug);
  const [secao, setSecao] = useState<Secao>("mesas");
  const [tab, setTab] = useState<Tab>("todos");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qrOrder, setQrOrder] = useState<WaiterOrder | null>(null);
  const now = useNow();

  const { data, isLoading, isError } = useWaiterOrders(
    orgSlug,
    identity?.collaboratorId ?? null,
  );
  const deliverOrder = useWaiterDeliverOrder(
    orgSlug,
    identity?.collaboratorId ?? null,
  );

  const orders: WaiterOrder[] = data?.orders ?? [];
  const orgName = data?.orgName ?? "";

  const counts = useMemo(() => countTabs(orders, now), [orders, now]);
  const visible = useMemo(
    () => filterByTab(orders, tab, now),
    [orders, tab, now],
  );

  // Buzz no celular quando aparece o 1º pedido pronto.
  const prevReady = useRef(0);
  useEffect(() => {
    if (
      counts.prontos > prevReady.current &&
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(200);
    }
    prevReady.current = counts.prontos;
  }, [counts.prontos]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!identity) {
    return <IdentityPicker orgSlug={orgSlug} onPick={save} />;
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <TriangleAlert className="size-10 text-amber-500" />
        <p className="text-base font-semibold">Não foi possível carregar</p>
        <p className="text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
        <Button variant="outline" onClick={clear}>
          Trocar atendente
        </Button>
      </div>
    );
  }

  return (
    <>
      <WaiterShell
        orgName={orgName}
        identity={identity}
        onSwitchIdentity={clear}
      />

      {secao === "mesas" ? (
        <main className="flex-1">
          <Salao orgSlug={orgSlug} attendantId={identity.collaboratorId} />
        </main>
      ) : (
        <>
          <WaiterTabs active={tab} onChange={setTab} counts={counts} />

          <main className="flex-1 px-4 pb-32">
            {isLoading ? (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <Empty className="mt-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardList className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum pedido nesta aba</EmptyTitle>
                  <EmptyDescription>
                    Toque em "Novo pedido" para registrar.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                {visible.map((order) => (
                  <WaiterOrderCard
                    key={order.id}
                    order={order}
                    onOpenQr={setQrOrder}
                    onDeliver={(o) =>
                      identity &&
                      deliverOrder.mutate({
                        orgSlug,
                        attendantId: identity.collaboratorId,
                        orderId: o.id,
                      })
                    }
                    deliverPending={deliverOrder.isPending}
                  />
                ))}
              </div>
            )}
          </main>

          <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center px-4">
            <Button
              size="lg"
              className="w-full max-w-md shadow-lg"
              onClick={() => setSheetOpen(true)}
            >
              <Plus className="size-5" />
              Novo pedido
            </Button>
          </div>
        </>
      )}

      {/* Barra de seções: fica por cima de tudo, inclusive da grade, porque é
          o único jeito de voltar para o salão sem gesto do sistema. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t bg-background">
        <SecaoBotao
          ativa={secao === "mesas"}
          onClick={() => setSecao("mesas")}
          icone={<LayoutGrid className="size-5" />}
          rotulo="Mesas"
        />
        <SecaoBotao
          ativa={secao === "pedidos"}
          onClick={() => setSecao("pedidos")}
          icone={<ReceiptText className="size-5" />}
          rotulo="Meus pedidos"
          contagem={counts.prontos}
        />
      </nav>

      <WaiterRegisterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orgSlug={orgSlug}
        attendantId={identity.collaboratorId}
      />

      {qrOrder && (
        <OrderQrDialog
          open={qrOrder != null}
          onOpenChange={(next) => !next && setQrOrder(null)}
          orderId={qrOrder.id}
          tableNumber={qrOrder.tableNumber}
          dishName={qrOrder.dishName}
        />
      )}
    </>
  );
}

function SecaoBotao({
  ativa,
  onClick,
  icone,
  rotulo,
  contagem = 0,
}: {
  ativa: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  rotulo: string;
  contagem?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativa ? "page" : undefined}
      className={
        ativa
          ? "relative flex h-16 flex-col items-center justify-center gap-1 text-sm font-semibold text-primary"
          : "relative flex h-16 flex-col items-center justify-center gap-1 text-sm text-muted-foreground"
      }
    >
      {icone}
      {rotulo}
      {contagem > 0 && (
        <span className="absolute right-[22%] top-2 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
          {contagem}
        </span>
      )}
    </button>
  );
}
