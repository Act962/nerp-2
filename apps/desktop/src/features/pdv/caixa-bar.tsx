import type { CashSummary, LocalCashSession } from "@nerp/core";
import { useState } from "react";
import {
  clearSession,
  closeCaixa,
  currentSession,
  openCaixa,
  sangria,
  suprimento,
} from "../../lib/caixa";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parseAmount = (str: string) =>
  Math.round((Number(str.replace(",", ".")) || 0) * 100) / 100;
const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Falha na operação";

type Dialog = "open" | "sangria" | "suprimento" | "close";
type CloseResult = CashSummary & { difference: number };

/**
 * Barra de caixa do PDV: status (aberto/fechado · terminal · operador) e as
 * ações (abrir/sangria/suprimento/fechar). O fechamento é contagem CEGA — o
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
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);

  const open = session?.status === "open" ? session : null;

  const start = (which: Dialog) => {
    setDialog(which);
    setAmount("");
    setError(null);
    setCloseResult(null);
  };

  const refresh = async () => onChange(await currentSession());

  const doOpen = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await openCaixa({
        openingBalance: parseAmount(amount),
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
      await fn(parseAmount(amount));
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
      const result = await closeCaixa(parseAmount(amount));
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

  return (
    <div className="caixa-bar">
      <div className="caixa-status">
        <span className={`badge ${open ? "online" : "offline"}`}>
          {open ? "Caixa aberto" : "Caixa fechado"}
        </span>
        {open && (
          <span className="muted small">
            {registerName} · {operatorName} · abertura{" "}
            {brl(open.openingBalance)}
          </span>
        )}
      </div>

      <div className="caixa-actions">
        {open ? (
          <>
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
          </>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={() => start("open")}
          >
            Abrir caixa
          </button>
        )}
      </div>

      {dialog && (
        <div className="pay-overlay">
          <div className="pay-modal">
            {dialog === "open" && (
              <>
                <div className="pay-head">
                  <span>Abrir caixa</span>
                  <span className="muted small">{registerName}</span>
                </div>
                <label className="pay-amount">
                  <span className="muted small">Saldo inicial (troco)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    // biome-ignore lint/a11y/noAutofocus: caixa é teclado-first
                    autoFocus
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </label>
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
                <label className="pay-amount">
                  <span className="muted small">Valor</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    // biome-ignore lint/a11y/noAutofocus: caixa é teclado-first
                    autoFocus
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </label>
                {error && <p className="error">{error}</p>}
                <div className="pay-actions">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      void doMovement(
                        dialog === "sangria" ? sangria : suprimento,
                      )
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
                <label className="pay-amount">
                  <span className="muted small">
                    Valor contado na gaveta (contagem cega)
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    // biome-ignore lint/a11y/noAutofocus: caixa é teclado-first
                    autoFocus
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </label>
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
                <ul className="pay-tenders">
                  <li>
                    <span>Esperado</span>
                    <span>{brl(closeResult.expectedCash)}</span>
                  </li>
                  <li>
                    <span>Contado</span>
                    <span>{brl(parseAmount(amount))}</span>
                  </li>
                  <li>
                    <span>Diferença</span>
                    <span
                      className={closeResult.difference === 0 ? "" : "error"}
                    >
                      {brl(closeResult.difference)}
                    </span>
                  </li>
                </ul>
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
      )}
    </div>
  );
}
