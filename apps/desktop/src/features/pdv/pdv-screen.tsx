import {
  type LocalCashSession,
  type LocalProduct,
  type OutboxItem,
  watchReachability,
} from "@nerp/core";
import type { PaymentMethod } from "@nerp/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { currentSession, recordSale } from "../../lib/caixa";
import { getCatalog, syncNow } from "../../lib/catalog";
import { API_URL } from "../../lib/config";
import { enqueueSale, type SalePayload } from "../../lib/sales";
import { countPending, drainAll, listFailed, retryOp } from "../../lib/sync";
import type { StoredSession } from "../../lib/token-store";
import { CaixaBar } from "./caixa-bar";
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

// A outbox é unificada (venda + caixa): um item em falha NÃO é sempre uma venda.
// Cada tipo tem payload próprio — descrever por tipo evita ler `.total` de uma
// operação de caixa (que não tem) e quebrar o render inteiro do PDV.
const describeFailed = (item: OutboxItem): string => {
  const p = item.payload as Record<string, unknown>;
  const money = (v: unknown) => (typeof v === "number" ? brl(v) : "—");
  switch (item.type) {
    case "sale.create":
      return `Venda ${money(p.total)}`;
    case "cashSession.open":
      return `Abertura de caixa ${money(p.openingBalance)}`;
    case "cash.sangria":
      return `Sangria ${money(p.amount)}`;
    case "cash.suprimento":
      return `Suprimento ${money(p.amount)}`;
    case "cashSession.close":
      return `Fechamento de caixa ${money(p.countedBalance)}`;
    default:
      return item.type;
  }
};

// O operador não deve ver jargão do servidor. Traduz o erro técnico mais comum.
const humanizeError = (raw: string | undefined): string => {
  if (!raw) return "Falha ao sincronizar";
  if (/validation/i.test(raw))
    return "Dados incompatíveis — precisa de revisão";
  if (/fetch|network|timeout|ECONN/i.test(raw)) return "Sem conexão no momento";
  return raw;
};

const BarcodeIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M20 11a8 8 0 1 0-.5 3M20 5v6h-6"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type CartLine = { product: LocalProduct; qty: number };

/**
 * PDV — Corte 1 (redesenho): tela limpa e guiada. Um foco por vez — o campo de
 * leitura em destaque, a venda e o total como protagonistas, e o sync/pendências
 * fora do caminho (indicador discreto no cabeçalho + faixa recolhível). O caixa
 * fechado vira um único foco ("Abrir caixa"); a lógica (sync/venda/caixa) é a mesma.
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
  const [showFailed, setShowFailed] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [caixaSession, setCaixaSession] = useState<LocalCashSession | null>(
    null,
  );
  const searchRef = useRef(search);
  searchRef.current = search;
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchLocal = useCallback(async (term: string) => {
    const catalog = await getCatalog();
    setProducts(await catalog.searchProducts(term));
  }, []);

  const refreshQueue = useCallback(async () => {
    setPending(await countPending());
    setFailed(await listFailed());
  }, []);

  // Sincroniza catálogo (pull) e drena a outbox. Chamado ao reconectar e por timer.
  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow();
      const catalog = await getCatalog();
      setLastSyncedAt(await catalog.getLastSyncedAt());
      await searchLocal(searchRef.current);
      await drainAll();
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
      setCaixaSession(await currentSession());
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

  const addToCart = (product: LocalProduct) => {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(product.id);
      next.set(product.id, { product, qty: (line?.qty ?? 0) + 1 });
      return next;
    });
    searchInputRef.current?.focus();
  };

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
  const caixaOpen = caixaSession?.status === "open";
  const canFinalize = caixaOpen && lines.length > 0 && !finalizing && !paying;

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
      // Caixa obrigatório: a venda tem de cair numa sessão aberta.
      const session = await currentSession();
      if (!session || session.status !== "open") {
        setPaying(false);
        setNotice("Abra o caixa antes de vender.");
        return;
      }
      const payload: SalePayload = {
        clientSessionId: session.clientSessionId,
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
      // Registra a venda no livro do caixa (VENDA por forma) para o esperado.
      await recordSale(payments);
      setCaixaSession(await currentSession());
      setCart(new Map());
      setPaying(false);
      setNotice("Venda registrada.");
      // Tenta drenar sempre; se o server estiver fora, fica pendente e sincroniza depois.
      await drainAll();
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
    await retryOp(id);
    await refreshQueue();
  };

  // Atalho F2 = finalizar venda (a ação primária do balcão).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && canFinalize) {
        e.preventDefault();
        setPaying(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canFinalize]);

  return (
    <div className="screen">
      <header className="app-header">
        <div className="app-id">
          <span className="app-brand">
            <BarcodeIcon />
            NERP Caixa
          </span>
          <span className="dot-sep">·</span>
          <span className="muted small">{session.organizationName}</span>
        </div>
        <div className="app-actions">
          <button
            type="button"
            className="icon-btn sync-chip"
            onClick={() => void syncAll()}
            title={
              syncing
                ? "Sincronizando…"
                : reachable
                  ? `Sincronizar · última ${timeAgo(lastSyncedAt)}`
                  : "Sem conexão"
            }
          >
            <span className={syncing ? "spin" : undefined}>
              <RefreshIcon />
            </span>
            {pending > 0 && <span className="count">{pending}</span>}
            {failed.length > 0 && (
              <span className="count danger">{failed.length}</span>
            )}
          </button>
          <button type="button" className="icon-btn" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      {!reachable && (
        <div className="offline-strip">
          Modo offline — {pending} na fila. As vendas continuam e sincronizam
          sozinhas ao reconectar.
        </div>
      )}

      <CaixaBar
        session={caixaSession}
        operatorName={session.operatorName}
        registerName={session.registerName}
        onChange={setCaixaSession}
      />

      {caixaOpen && (
        <main className="pdv-main">
          <div className="scan">
            <BarcodeIcon />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              // biome-ignore lint/a11y/noAutofocus: caixa é teclado-first
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escaneie o código de barras ou busque…"
            />
          </div>

          {failed.length > 0 && (
            <div className="failed-strip">
              <button
                type="button"
                className={`failed-head ${showFailed ? "open" : ""}`}
                onClick={() => setShowFailed((v) => !v)}
              >
                {failed.length} operação(ões) precisam de atenção
                <span className="chev">▾</span>
              </button>
              {showFailed && (
                <ul className="failed-list">
                  {failed.map((item) => (
                    <li key={item.id}>
                      <span className="muted small">
                        {describeFailed(item)} · {humanizeError(item.lastError)}
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
              )}
            </div>
          )}

          {search.trim() && (
            <>
              <p className="section-label">Resultados</p>
              <div className="results">
                {products.length === 0 ? (
                  <p className="muted small">
                    Nada encontrado para “{search}”.
                  </p>
                ) : (
                  products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="result-row"
                      onClick={() => addToCart(product)}
                    >
                      <div>
                        <div className="result-name">{product.name}</div>
                        <div className="muted small">
                          {product.sku || product.barcode || "sem código"} ·
                          estoque {product.currentStock} {product.unit}
                        </div>
                      </div>
                      <div className="result-price tnum">
                        {brl(product.salePrice)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          <section className="venda">
            {lines.length === 0 ? (
              <div className="venda-empty">
                <BarcodeIcon />
                <p>Escaneie ou busque um produto para começar a venda.</p>
              </div>
            ) : (
              <ul className="sale-list">
                {lines.map((line) => (
                  <li key={line.product.id} className="sale-row">
                    <div className="sale-info">
                      <div className="sale-name">{line.product.name}</div>
                      <div className="muted small tnum">
                        {brl(line.product.salePrice)}
                      </div>
                    </div>
                    <div className="qty">
                      <button
                        type="button"
                        onClick={() => changeQty(line.product.id, -1)}
                        aria-label="Diminuir"
                      >
                        −
                      </button>
                      <span>{line.qty}</span>
                      <button
                        type="button"
                        onClick={() => changeQty(line.product.id, 1)}
                        aria-label="Aumentar"
                      >
                        +
                      </button>
                    </div>
                    <div className="sale-total tnum">
                      {brl(line.product.salePrice * line.qty)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      )}

      {caixaOpen && (
        <div className="checkout">
          <div className="checkout-bar">
            <div className="checkout-total">
              <span className="muted small">Total</span>
              <strong className="tnum">{brl(cartTotal)}</strong>
            </div>
            <button
              type="button"
              className="btn primary lg checkout-action"
              disabled={!canFinalize}
              onClick={() => setPaying(true)}
            >
              {finalizing ? "Registrando…" : "Finalizar venda"}
              <kbd>F2</kbd>
            </button>
          </div>
          {notice && <p className="checkout-notice">{notice}</p>}
          <div className="hotkeys">
            <span>
              <kbd>F2</kbd> Finalizar
            </span>
            <span>
              <kbd>Esc</kbd> Cancelar pagamento
            </span>
          </div>
        </div>
      )}

      {paying && (
        <PaymentStep
          total={cartTotal}
          onCancel={() => setPaying(false)}
          onPaid={(payments) => void handlePaid(payments)}
        />
      )}
    </div>
  );
}
