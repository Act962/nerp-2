import { isOnline, type LocalProduct, onConnectivityChange } from "@nerp/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCatalog, syncNow } from "../../lib/catalog";
import {
  countPendingSales,
  drainSales,
  enqueueSale,
  type SalePayload,
} from "../../lib/sales";
import type { StoredSession } from "../../lib/token-store";

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
 * PDV — Fase 3: vende OFFLINE. O catálogo é lido do banco local (Fase 2); a
 * venda é gravada numa outbox local (nunca se perde) e replicada no server
 * quando há rede, que atribui o número oficial. Idempotente.
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
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  const searchLocal = useCallback(async (term: string) => {
    const catalog = await getCatalog();
    setProducts(await catalog.searchProducts(term));
  }, []);

  const refreshPending = useCallback(async () => {
    setPending(await countPendingSales());
  }, []);

  // Sincroniza catálogo (pull) e drena vendas (outbox) — só quando online.
  const syncAll = useCallback(async () => {
    if (!isOnline()) return;
    setSyncing(true);
    try {
      await syncNow();
      const catalog = await getCatalog();
      setLastSyncedAt(await catalog.getLastSyncedAt());
      await searchLocal(searchRef.current);
      await drainSales();
      await refreshPending();
    } catch {
      // offline/instável: mantém o que há local, tenta de novo depois.
    } finally {
      setSyncing(false);
    }
  }, [searchLocal, refreshPending]);

  useEffect(() => {
    void (async () => {
      await searchLocal("");
      await refreshPending();
      const catalog = await getCatalog();
      setLastSyncedAt(await catalog.getLastSyncedAt());
      await syncAll();
    })();
    return onConnectivityChange((up) => {
      setOnline(up);
      if (up) void syncAll();
    });
  }, [searchLocal, refreshPending, syncAll]);

  useEffect(() => {
    const id = setTimeout(() => void searchLocal(search), 200);
    return () => clearTimeout(id);
  }, [search, searchLocal]);

  const addToCart = (product: LocalProduct) => {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(product.id);
      next.set(product.id, { product, qty: (line?.qty ?? 0) + 1 });
      return next;
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(id);
      if (!line) return next;
      const qty = line.qty + delta;
      if (qty <= 0) next.delete(id);
      else next.set(id, { ...line, qty });
      return next;
    });
  };

  const lines = [...cart.values()];
  const cartTotal = lines.reduce(
    (sum, l) => sum + l.product.salePrice * l.qty,
    0,
  );

  const finalizeSale = async () => {
    if (lines.length === 0) return;
    setFinalizing(true);
    setNotice(null);
    try {
      const payload: SalePayload = {
        discount: 0,
        total: cartTotal,
        status: "COMPLETED",
        soldAt: new Date().toISOString(),
        payments: [{ method: "DINHEIRO", amount: cartTotal }],
        items: lines.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          quantity: l.qty,
          unitPrice: l.product.salePrice,
        })),
      };
      await enqueueSale(payload);
      setCart(new Map());
      await refreshPending();
      setNotice(
        isOnline()
          ? "Venda registrada. Sincronizando…"
          : "Venda registrada offline. Vai sincronizar ao reconectar.",
      );
      if (isOnline()) {
        await drainSales();
        await refreshPending();
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Falha ao registrar venda",
      );
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <strong>NERP Caixa</strong>
          <span className="muted"> · {session.organizationName}</span>
        </div>
        <div className="topbar-right">
          <span className={`badge ${online ? "online" : "offline"}`}>
            {online ? "Online" : "Offline"}
          </span>
          {pending > 0 && (
            <span className="badge pending">{pending} por sincronizar</span>
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
            onClick={() => void finalizeSale()}
          >
            {finalizing ? "Registrando…" : "Finalizar venda"}
          </button>
        </aside>
      </div>
    </div>
  );
}
