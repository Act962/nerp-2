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
  const [highlight, setHighlight] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saleResult, setSaleResult] = useState<{
    total: number;
    change: number;
  } | null>(null);
  const [caixaSession, setCaixaSession] = useState<LocalCashSession | null>(
    null,
  );
  const [booted, setBooted] = useState(false);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Ref do campo de quantidade da ÚLTIMA linha — para o atalho `*` (editar qtd
  // do item recém-adicionado sem mouse).
  const lastQtyRef = useRef<HTMLInputElement>(null);

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
      setCatalogEmpty((await catalog.count()) === 0);
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
      setCatalogEmpty((await catalog.count()) === 0);
      setBooted(true);
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

  // Novos resultados → destaque volta ao topo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset por mudança de resultados
  useEffect(() => setHighlight(0), [products]);

  // Foco "grudento" no leitor: o scanner digita no input FOCADO, então sempre
  // que não há operação em curso (nenhum modal/overlay aberto) o foco tem de
  // estar no campo de leitura. `focusScan` é um no-op quando há um overlay
  // (pagamento, diálogo de caixa `.pay-overlay`, ou confirmação `.sale-done`) —
  // aí quem manda é o overlay.
  const focusScan = useCallback(() => {
    if (document.querySelector(".pay-overlay, .sale-done")) return;
    searchInputRef.current?.focus();
  }, []);

  // Reafirma o foco a cada transição que costuma perdê-lo (fim de pagamento,
  // confirmação, abertura/fechamento de caixa, boot).
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps são gatilhos de re-execução, não referências do corpo
  useEffect(() => {
    focusScan();
  }, [focusScan, paying, saleResult, caixaSession, booted]);

  // E também nos eventos fora do ciclo do React: o app reganhar o foco do SO, e
  // cliques que caem fora de um campo (espaço vazio, botões do header/faixa).
  useEffect(() => {
    const onWinFocus = () => focusScan();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t?.closest(
          "input, textarea, select, [contenteditable], .pay-overlay, .sale-done",
        )
      )
        return;
      // Próximo tick: deixa um clique que abre diálogo montar o overlay antes.
      setTimeout(focusScan, 0);
    };
    window.addEventListener("focus", onWinFocus);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("focus", onWinFocus);
      document.removeEventListener("click", onDocClick);
    };
  }, [focusScan]);

  // Confirmação de venda: some sozinha em ~3,5s, ou com Enter/Esc; devolve o foco.
  useEffect(() => {
    if (!saleResult) return;
    const dismiss = () => {
      setSaleResult(null);
      searchInputRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    const id = setTimeout(dismiss, 3500);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(id);
    };
  }, [saleResult]);

  const addToCart = (product: LocalProduct, qty = 1) => {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(product.id);
      next.set(product.id, { product, qty: (line?.qty ?? 0) + qty });
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

  // Quantidade digitável na linha (dígitos; vazio/zero mantém a atual).
  const setQty = (id: string, raw: string) =>
    setCart((prev) => {
      const n = Number.parseInt(raw.replace(/\D/g, ""), 10);
      const line = prev.get(id);
      if (!line || Number.isNaN(n) || n < 1) return prev;
      const next = new Map(prev);
      next.set(id, { ...line, qty: n });
      return next;
    });

  const removeLine = (id: string) =>
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

  // Leitor de código / Enter: casa o código EXATO (barcode ou SKU) e adiciona
  // direto — o loop do balcão. Sem código exato, adiciona o resultado destacado.
  // Consulta o catálogo na hora (o scanner digita rápido, o `products` debounced
  // pode estar defasado).
  const addByEnter = async () => {
    const raw = search.trim();
    if (!raw) return;
    // Multiplicador opcional: "5*código" / "5x nome" adiciona 5 de uma vez.
    // O separador `*`/`x` não aparece em código de barras, então bipar puro
    // continua sendo 1 unidade. O operador digita `5*` e DEPOIS bipa.
    const mult = raw.match(/^(\d{1,4})\s*[*xX]\s*(.+)$/);
    const qty = mult ? Math.max(1, Number.parseInt(mult[1], 10)) : 1;
    const term = mult ? mult[2].trim() : raw;
    if (!term) return;
    const catalog = await getCatalog();
    const results = await catalog.searchProducts(term);
    if (results.length === 0) return;
    const low = term.toLowerCase();
    const exact = results.find(
      (p) => p.barcode.toLowerCase() === low || p.sku.toLowerCase() === low,
    );
    const chosen = exact ?? results[Math.min(highlight, results.length - 1)];
    if (chosen) {
      addToCart(chosen, qty);
      setSearch("");
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // `*` com o campo VAZIO = editar a quantidade do último item (sem mouse).
    // Com o campo preenchido, `*` é o separador do multiplicador (deixa digitar).
    if (e.key === "*" && search.trim() === "") {
      e.preventDefault();
      lastQtyRef.current?.focus();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void addByEnter();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, products.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
  };

  const lines = [...cart.values()];
  const cartTotal = lines.reduce((s, l) => s + l.product.salePrice * l.qty, 0);
  const caixaOpen = caixaSession?.status === "open";
  const canFinalize = caixaOpen && lines.length > 0 && !finalizing && !paying;

  // Chamado pelo passo de pagamento quando a venda está paga: grava na outbox
  // (offline-first, nunca perde) e tenta drenar. As formas vêm dos tenders
  // liquidados (dinheiro manual e/ou transação aprovada do PaymentProcessor).
  const handlePaid = async (
    payments: { method: PaymentMethod; amount: number }[],
    change: number,
  ) => {
    if (lines.length === 0) return;
    const soldTotal = cartTotal;
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
      setNotice(null);
      // Confirmação forte da venda (com troco em destaque quando há).
      setSaleResult({ total: soldTotal, change });
      // Tenta drenar sempre; se o server estiver fora, fica pendente e sincroniza depois.
      await drainAll();
      await refreshQueue();
    } catch (err) {
      setNotice(humanizeError(err instanceof Error ? err.message : undefined));
    } finally {
      setFinalizing(false);
    }
  };

  const onRetry = async (id: string) => {
    await retryOp(id);
    await refreshQueue();
  };

  // Atalhos globais: F2 finaliza a venda; F4 devolve o foco ao leitor (resgate).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && canFinalize) {
        e.preventDefault();
        setPaying(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        focusScan();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canFinalize, focusScan]);

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
          <span className="offline-dot" />
          <strong>Modo offline</strong>
          <span>
            — {pending} na fila. As vendas continuam e sincronizam sozinhas ao
            reconectar.
          </span>
        </div>
      )}

      {!booted && (
        <div className="boot">
          <div className="skeleton skeleton-scan" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      )}

      {booted && (
        <CaixaBar
          session={caixaSession}
          operatorName={session.operatorName}
          registerName={session.registerName}
          onChange={setCaixaSession}
        />
      )}

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
              onKeyDown={onSearchKeyDown}
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
                  products.map((product, i) => (
                    <button
                      key={product.id}
                      type="button"
                      className={`result-row ${i === highlight ? "active" : ""}`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => {
                        addToCart(product);
                        setSearch("");
                      }}
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
                {catalogEmpty ? (
                  <>
                    <p>Catálogo vazio neste terminal.</p>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void syncAll()}
                    >
                      Sincronizar produtos
                    </button>
                  </>
                ) : (
                  <p>Escaneie ou busque um produto para começar a venda.</p>
                )}
              </div>
            ) : (
              <ul className="sale-list">
                {lines.map((line, i) => (
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
                      <input
                        ref={i === lines.length - 1 ? lastQtyRef : null}
                        className="qty-input tnum"
                        type="text"
                        inputMode="numeric"
                        value={line.qty}
                        aria-label="Quantidade"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setQty(line.product.id, e.target.value)
                        }
                        onKeyDown={(e) => {
                          // Enter/Esc confirmam a quantidade e devolvem o foco ao
                          // leitor — o loop do balcão sem mouse.
                          if (e.key === "Enter" || e.key === "Escape") {
                            e.preventDefault();
                            searchInputRef.current?.focus();
                          }
                        }}
                      />
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
                    <button
                      type="button"
                      className="sale-remove"
                      onClick={() => removeLine(line.product.id)}
                      aria-label="Remover item"
                    >
                      ×
                    </button>
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
              <kbd>↑↓</kbd> Navegar
            </span>
            <span>
              <kbd>Enter</kbd> Adicionar
            </span>
            <span>
              <kbd>N*</kbd> Quantidade
            </span>
            <span>
              <kbd>*</kbd> Editar qtd
            </span>
            <span>
              <kbd>F2</kbd> Finalizar
            </span>
            <span>
              <kbd>F4</kbd> Focar busca
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
          onPaid={(payments, change) => void handlePaid(payments, change)}
        />
      )}

      {saleResult && (
        <button
          type="button"
          className="sale-done"
          onClick={() => {
            setSaleResult(null);
            searchInputRef.current?.focus();
          }}
        >
          <div className="sale-done-card">
            <div className="sale-done-check">✓</div>
            <h2>Venda concluída</h2>
            <div className="sale-done-total tnum">{brl(saleResult.total)}</div>
            {saleResult.change > 0 && (
              <div className="sale-done-change">
                <span>Troco</span>
                <strong className="tnum">{brl(saleResult.change)}</strong>
              </div>
            )}
            <p className="muted small">Pressione Enter para a próxima venda</p>
          </div>
        </button>
      )}
    </div>
  );
}
