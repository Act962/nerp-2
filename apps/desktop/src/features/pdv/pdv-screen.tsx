import {
  type LocalProduct,
  type OutboxItem,
  watchReachability,
} from "@nerp/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCatalog, syncNow } from "../../lib/catalog";
import { API_URL } from "../../lib/config";
import {
  countPendingSales,
  drainSales,
  enqueueSale,
  listFailedSales,
  retrySale,
  type SalePayload,
} from "../../lib/sales";
import type { StoredSession } from "../../lib/token-store";
import type { PaymentMethod } from "@nerp/types";
import { PaymentStep } from "./payment-step";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const timeAgo = (iso: string | null) => {
  if (!iso) return "nunca";
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "agora";
  if (secs < 3600) return `há ${Math.floor(secs / 60)} min`;
  return `há ${Math.floor(secs / 3600)} h`;
};

type CartLine = { product: LocalProduct; qty: number };

/**
 * PDV — Fase 4 (endurecido): o indicador reflete o ALCANCE REAL do servidor
 * (ping em /api/health, não só navigator.onLine); pendências drenam sozinhas ao
 * reconectar e por timer; vendas que esgotam as tentativas viram dead-letter
 * visível, com retry manual.
 */
export function PdvScreen({
  session,
  onLogout,
}: {
  session: StoredSession;
  onLogout: () => void;
}) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [reachable, setReachable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<OutboxItem[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  const searchLocal = useCallback(async (term: string) => {
    const catalog = await getCatalog();
    setProducts(await catalog.searchProducts(term));
  }, []);

  const refreshQueue = useCallback(async () => {
    setPending(await countPendingSales());
    setFailed(await listFailedSales());
  }, []);

  // Sincroniza catálogo (pull) e drena a outbox. Chamado ao reconectar e por timer.
  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow();
      const catalog = await getCatalog();
      setLastSyncedAt(await catalog.getLastSyncedAt());
      await searchLocal(searchRef.current);
      await drainSales();
      await refreshQueue();
    } catch {
      // instável: mantém o que há local, tenta de novo no próximo ciclo.
    } finally {
      setSyncing(false);
    }
  }, [searchLocal, refreshQueue]);

  useEffect(() => {
    void (async () => {
      await searchLocal("");
      await refreshQueue();
      const catalog = await getCatalog();
      setLastSyncedAt(await catalog.getLastSyncedAt());
    })();

    // Alcance real do servidor: dispara sync quando (re)fica acessível.
    const stopWatch = watchReachability(API_URL, (up) => {
      setReachable(up);
      if (up) void syncAll();
    });
    // Rede de segurança: enquanto acessível, drena pendências a cada 20s.
    const timer = setInterval(() => void syncAll(), 20000);
    return () => {
      stopWatch();
      clearInterval(timer);
    };
  }, [searchLocal, refreshQueue, syncAll]);

  useEffect(() => {
    const id = setTimeout(() => void searchLocal(search), 200);
    return () => clearTimeout(id);
  }, [search, searchLocal]);

  const addToCart = (product: LocalProduct) =>
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(product.id);
      next.set(product.id, { product, qty: (line?.qty ?? 0) + 1 });
      return next;
    });

  const changeQty = (id: string, delta: number) =>
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(id);
      if (!line) return next;
      const qty = line.qty + delta;
      if (qty <= 0) next.delete(id);
      else next.set(id, { ...line, qty });
      return next;
    });

  const lines = [...cart.values()];
  const cartTotal = lines.reduce((s, l) => s + l.product.salePrice * l.qty, 0);

  // Chamado pelo passo de pagamento quando a venda está paga: grava na outbox
  // (offline-first, nunca perde) e tenta drenar. As formas vêm dos tenders
  // liquidados (dinheiro manual e/ou transação aprovada do PaymentProcessor).
  const handlePaid = async (
    payments: { method: PaymentMethod; amount: number }[],
  ) => {
    if (lines.length === 0) return;
    setFinalizing(true);
    setNotice(null);
    try {
      const payload: SalePayload = {
        discount: 0,
        total: cartTotal,
        status: "COMPLETED",
        soldAt: new Date().toISOString(),
        payments,
        items: lines.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          quantity: l.qty,
          unitPrice: l.product.salePrice,
        })),
      };
      await enqueueSale(payload);
      setCart(new Map());
      setPaying(false);
      setNotice("Venda registrada.");
      // Tenta drenar sempre; se o server estiver fora, fica pendente e sincroniza depois.
      await drainSales();
      await refreshQueue();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Falha ao registrar venda",
      );
    } finally {
      setFinalizing(false);
    }
  };

  const onRetry = async (id: string) => {
    await retrySale(id);
    await refreshQueue();
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <strong>NERP Caixa</strong>
          <span className="muted"> · {session.organizationName}</span>
        </div>
        <div className="topbar-right">
          <span className={`badge ${reachable ? "online" : "offline"}`}>
            {reachable ? "Online" : "Offline"}
          </span>
          {pending > 0 && (
            <span className="badge pending">{pending} por sincronizar</span>
          )}
          {failed.length > 0 && (
            <span className="badge failed">{failed.length} com falha</span>
          )}
          <span className="muted small">
            sync {syncing ? "…" : timeAgo(lastSyncedAt)}
          </span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void syncAll()}
          >
            Sincronizar
          </button>
          <button type="button" className="btn ghost" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <div className="pdv-layout">
        <main className="pdv-products">
          <input
            className="search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto por nome, SKU ou código de barras…"
          />

          {failed.length > 0 && (
            <div className="dead-letter">
              <strong>Vendas com falha de sincronização</strong>
              <ul>
                {failed.map((item) => (
                  <li key={item.id}>
                    <span className="muted small">
                      {brl((item.payload as SalePayload).total)} ·{" "}
                      {item.lastError}
                    </span>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void onRetry(item.id)}
                    >
                      Tentar de novo
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="product-list">
            {products.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  className="product-row as-button"
                  onClick={() => addToCart(product)}
                >
                  <div>
                    <div className="product-name">{product.name}</div>
                    <div className="muted small">
                      {product.sku || product.barcode || "sem código"} · estoque{" "}
                      {product.currentStock} {product.unit}
                    </div>
                  </div>
                  <div className="product-price">{brl(product.salePrice)}</div>
                </button>
              </li>
            ))}
          </ul>
        </main>

        <aside className="pdv-cart">
          <h2>Venda</h2>
          {lines.length === 0 && (
            <p className="muted">Toque num produto para adicionar.</p>
          )}
          <ul className="cart-list">
            {lines.map((line) => (
              <li key={line.product.id} className="cart-line">
                <div className="cart-line-info">
                  <div className="product-name">{line.product.name}</div>
                  <div className="muted small">
                    {brl(line.product.salePrice)}
                  </div>
                </div>
                <div className="qty">
                  <button
                    type="button"
                    onClick={() => changeQty(line.product.id, -1)}
                  >
                    −
                  </button>
                  <span>{line.qty}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(line.product.id, 1)}
                  >
                    +
                  </button>
                </div>
                <div className="product-price">
                  {brl(line.product.salePrice * line.qty)}
                </div>
              </li>
            ))}
          </ul>

          {notice && <p className="muted small">{notice}</p>}

          <div className="cart-total">
            <span>Total</span>
            <strong>{brl(cartTotal)}</strong>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={lines.length === 0 || finalizing}
            onClick={() => setPaying(true)}
          >
            {finalizing ? "Registrando…" : "Finalizar venda"}
          </button>
        </aside>

        {paying && (
          <PaymentStep
            total={cartTotal}
            onCancel={() => setPaying(false)}
            onPaid={(payments) => void handlePaid(payments)}
          />
        )}
      </div>
    </div>
  );
}
