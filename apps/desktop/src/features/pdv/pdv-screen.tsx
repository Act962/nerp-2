import { isOnline, type LocalProduct, onConnectivityChange } from "@nerp/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCatalog, syncNow } from "../../lib/catalog";
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

/**
 * PDV — Fase 2: LÊ do catálogo LOCAL (funciona offline). Quando online,
 * sincroniza o catálogo em background; a busca sempre bate no banco local.
 * Escrita de venda offline é a Fase 3.
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
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  const searchLocal = useCallback(async (term: string) => {
    const catalog = await getCatalog();
    setProducts(await catalog.searchProducts(term));
  }, []);

  const refreshMeta = useCallback(async () => {
    const catalog = await getCatalog();
    setCount(await catalog.count());
    setLastSyncedAt(await catalog.getLastSyncedAt());
  }, []);

  // Sincroniza (se online) e recarrega a busca atual do banco local.
  const sync = useCallback(async () => {
    if (!isOnline()) return;
    setSyncing(true);
    setError(null);
    try {
      await syncNow();
      await refreshMeta();
      await searchLocal(searchRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [refreshMeta, searchLocal]);

  // Boot: mostra o que já tem local na hora, depois tenta sincronizar.
  useEffect(() => {
    void (async () => {
      await refreshMeta();
      await searchLocal("");
      await sync();
    })();
    return onConnectivityChange((isUp) => {
      setOnline(isUp);
      if (isUp) void sync();
    });
  }, [refreshMeta, searchLocal, sync]);

  // Busca sempre local (offline-capable), com debounce.
  useEffect(() => {
    const id = setTimeout(() => void searchLocal(search), 200);
    return () => clearTimeout(id);
  }, [search, searchLocal]);

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
          <span className="muted small">
            {count ?? 0} itens · sync {syncing ? "…" : timeAgo(lastSyncedAt)}
          </span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void sync()}
          >
            Sincronizar
          </button>
          <button type="button" className="btn ghost" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <main className="pdv">
        <input
          className="search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto por nome, SKU ou código de barras…"
        />

        {error && <p className="error">{error}</p>}

        {count === 0 && !syncing && (
          <p className="muted">
            Catálogo local vazio.{" "}
            {online ? "Sincronizando…" : "Conecte para sincronizar."}
          </p>
        )}

        <ul className="product-list">
          {products.map((product) => (
            <li key={product.id} className="product-row">
              <div>
                <div className="product-name">{product.name}</div>
                <div className="muted small">
                  {product.sku || product.barcode || "sem código"} · estoque{" "}
                  {product.currentStock} {product.unit}
                </div>
              </div>
              <div className="product-price">{brl(product.salePrice)}</div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
