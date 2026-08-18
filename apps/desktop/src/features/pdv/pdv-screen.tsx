import { useCallback, useEffect, useState } from "react";
import { client } from "../../lib/client";
import type { StoredSession } from "../../lib/token-store";

type Product = {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  currentStock: number;
  unit: string;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Tela de PDV — Fase 1 é só LEITURA online: busca produtos pela API com o token
// de device. Carrinho e venda offline entram nas fases seguintes.
export function PdvScreen({
  session,
  onLogout,
}: {
  session: StoredSession;
  onLogout: () => void;
}) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.products.list({
        limit: 20,
        search: term || undefined,
      });
      setProducts(result.products);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao carregar produtos",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(search), 300);
    return () => clearTimeout(id);
  }, [search, load]);

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <strong>NERP Caixa</strong>
          <span className="muted"> · {session.organizationName}</span>
        </div>
        <div className="topbar-right">
          <span className="badge online">
            {navigator.onLine ? "Online" : "Offline"}
          </span>
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
        {loading && <p className="muted">Carregando…</p>}

        {!loading && products.length === 0 && !error && (
          <p className="muted">Nenhum produto encontrado.</p>
        )}

        <ul className="product-list">
          {products.map((product) => (
            <li key={product.id} className="product-row">
              <div>
                <div className="product-name">{product.name}</div>
                <div className="muted small">
                  {product.sku} · estoque {product.currentStock} {product.unit}
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
