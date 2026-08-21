import type { CashSummary, LocalCashSession } from "@nerp/core";
import { useEffect, useRef, useState } from "react";
import {
  clearSession,
  closeCaixa,
  currentSession,
  openCaixa,
  sangria,
  suprimento,
} from "../../lib/caixa";
import { MoneyInput } from "./money-input";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Falha na operação";

type Dialog = "open" | "sangria" | "suprimento" | "close";
type CloseResult = CashSummary & {
  difference: number;
  openingBalance: number;
  counted: number;
};

const LockIcon = () => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="5"
      y="11"
      width="14"
      height="9"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M8 11V8a4 4 0 0 1 8 0v3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Caixa do PDV. Dois modos: FECHADO vira o único foco da tela ("Abrir caixa");
 * ABERTO vira uma faixa fina (status + ações). O fechamento é contagem CEGA — o
 * esperado só aparece depois que o operador informa o contado.
 */
export function CaixaBar({
  session,
  operatorName,
  registerName,
  onChange,
}: {
  session: LocalCashSession | null;
  operatorName: string;
  registerName: string;
  onChange: (session: LocalCashSession | null) => void;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Valor do diálogo em CENTAVOS (inteiro) — máscara de moeda no `MoneyInput`.
  const [cents, setCents] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);

  const open = session?.status === "open" ? session : null;

  const start = (which: Dialog) => {
    setDialog(which);
    setCents(0);
    setError(null);
    setCloseResult(null);
  };

  const refresh = async () => onChange(await currentSession());

  const doOpen = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await openCaixa({
        openingBalance: cents / 100,
        registerName,
        operator: { name: operatorName },
      });
      onChange(s);
      setDialog(null);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const doMovement = async (fn: (a: number) => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn(cents / 100);
      await refresh();
      setDialog(null);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const doClose = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await closeCaixa(cents / 100);
      setCloseResult(result);
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const finishClose = async () => {
    await clearSession();
    onChange(null);
    setDialog(null);
    setCloseResult(null);
  };

  // Teclado-first nos diálogos: Enter confirma a ação primária; Esc cancela (ou
  // conclui a revelação do fechamento). Nunca dispara durante uma operação.
  // Ref com o handler SEMPRE atual (fecha sobre cents/busy correntes) mantém o
  // listener estável — sem re-inscrever a cada render.
  const dialogKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  dialogKeyRef.current = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (dialog === "close" && closeResult) void finishClose();
      else if (!busy) setDialog(null);
      return;
    }
    if (e.key !== "Enter" || busy) return;
    e.preventDefault();
    if (dialog === "close" && closeResult) void finishClose();
    else if (dialog === "open") void doOpen();
    else if (dialog === "sangria") void doMovement(sangria);
    else if (dialog === "suprimento") void doMovement(suprimento);
    else if (dialog === "close") void doClose();
  };
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => dialogKeyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const overlay = dialog && (
    <div className="pay-overlay">
      <div className="pay-modal">
        {dialog === "open" && (
          <>
            <div className="pay-head">
              <span>Abrir caixa</span>
              <span className="muted small">{registerName}</span>
            </div>
            <div className="pay-amount">
              <span className="muted small">Saldo inicial (troco)</span>
              <MoneyInput
                cents={cents}
                onCents={setCents}
                autoFocus
                ariaLabel="Saldo inicial"
              />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="pay-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => void doOpen()}
              >
                {busy ? "Abrindo…" : "Abrir"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {(dialog === "sangria" || dialog === "suprimento") && (
          <>
            <div className="pay-head">
              <span>{dialog === "sangria" ? "Sangria" : "Suprimento"}</span>
            </div>
            <div className="pay-amount">
              <span className="muted small">Valor</span>
              <MoneyInput
                cents={cents}
                onCents={setCents}
                autoFocus
                ariaLabel="Valor"
              />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="pay-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void doMovement(dialog === "sangria" ? sangria : suprimento)
                }
              >
                {busy ? "…" : "Confirmar"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {dialog === "close" && !closeResult && (
          <>
            <div className="pay-head">
              <span>Fechar caixa</span>
            </div>
            <div className="pay-amount">
              <span className="muted small">
                Valor contado na gaveta (contagem cega)
              </span>
              <MoneyInput
                cents={cents}
                onCents={setCents}
                autoFocus
                ariaLabel="Valor contado na gaveta"
              />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="pay-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => void doClose()}
              >
                {busy ? "Fechando…" : "Fechar"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {dialog === "close" && closeResult && (
          <>
            <div className="pay-head">
              <span>Caixa fechado</span>
            </div>
            <ul className="close-breakdown">
              <li>
                <span>Abertura</span>
                <span className="tnum">{brl(closeResult.openingBalance)}</span>
              </li>
              <li>
                <span>Suprimentos</span>
                <span className="tnum">+ {brl(closeResult.suprimentos)}</span>
              </li>
              <li>
                <span>Vendas em dinheiro</span>
                <span className="tnum">+ {brl(closeResult.salesCash)}</span>
              </li>
              <li>
                <span>Sangrias</span>
                <span className="tnum">− {brl(closeResult.sangrias)}</span>
              </li>
              <li className="close-expected">
                <span>Esperado na gaveta</span>
                <span className="tnum">{brl(closeResult.expectedCash)}</span>
              </li>
              <li>
                <span>Contado</span>
                <span className="tnum">{brl(closeResult.counted)}</span>
              </li>
              <li
                className={`close-diff ${closeResult.difference === 0 ? "ok" : "off"}`}
              >
                <span>Diferença</span>
                <span className="tnum">{brl(closeResult.difference)}</span>
              </li>
            </ul>
            <p className="muted small">
              Total vendido na sessão: {brl(closeResult.salesTotal)}
            </p>
            <button
              type="button"
              className="btn primary"
              onClick={() => void finishClose()}
            >
              Concluir
            </button>
          </>
        )}
      </div>
    </div>
  );

  // FECHADO — único foco da tela.
  if (!open) {
    return (
      <>
        <div className="caixa-focus">
          <div className="caixa-focus-card">
            <div className="caixa-focus-icon">
              <LockIcon />
            </div>
            <h2>Caixa fechado</h2>
            <p className="muted">Abra o caixa para começar a vender.</p>
            <button
              type="button"
              className="btn primary lg"
              onClick={() => start("open")}
            >
              Abrir caixa
            </button>
          </div>
        </div>
        {overlay}
      </>
    );
  }

  // ABERTO — faixa fina.
  return (
    <>
      <div className="caixa-strip">
        <span className="caixa-state">
          <span className="dot on" />
          Caixa aberto
          <span className="muted">
            · {registerName} · {operatorName} · abertura{" "}
            {brl(open.openingBalance)}
          </span>
        </span>
        <div className="caixa-strip-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => start("suprimento")}
          >
            Suprimento
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => start("sangria")}
          >
            Sangria
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => start("close")}
          >
            Fechar caixa
          </button>
        </div>
      </div>
      {overlay}
    </>
  );
}
