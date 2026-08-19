import {
  isFullyPaid,
  type MockOutcome,
  type PaymentInstrument,
  type PaymentSnapshot,
} from "@nerp/core";
import type { PaymentMethod } from "@nerp/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  capturePayment,
  getMockOutcome,
  instrumentToMethod,
  reconcilePayment,
  setMockOutcome,
} from "../../lib/payment";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const round2 = (n: number) => Math.round(n * 100) / 100;
const parseAmount = (str: string) =>
  round2(Number(str.replace(/\./g, "").replace(",", ".")) || 0);
const toInput = (n: number) => n.toFixed(2).replace(".", ",");

/** Um pagamento já liquidado nesta venda (dinheiro manual ou cartão aprovado). */
type AddedTender = { method: PaymentMethod; amount: number; label: string };
type Payment = { method: PaymentMethod; amount: number };

const INSTRUMENTS: {
  instrument: PaymentInstrument;
  label: string;
  hotkey: string;
}[] = [
  { instrument: "credit", label: "Crédito", hotkey: "2" },
  { instrument: "debit", label: "Débito", hotkey: "3" },
  { instrument: "pix", label: "PIX", hotkey: "4" },
];

const OUTCOMES: { value: MockOutcome; label: string }[] = [
  { value: "approve", label: "Aprovar" },
  { value: "decline", label: "Recusar" },
  { value: "timeout", label: "Timeout" },
];

/**
 * Passo de pagamento do PDV (corte 3): pagamento MISTO.
 *
 * Acumula tenders (dinheiro manual e/ou cartão/PIX pelo `PaymentProcessor`) com
 * um valor por lançamento — default = "falta receber". A venda só finaliza
 * (`onPaid`) quando os tenders aprovados cobrem o total (`isFullyPaid`).
 * `timeout` NÃO finaliza às cegas — oferece Reconciliar.
 */
export function PaymentStep({
  total,
  onPaid,
  onCancel,
}: {
  total: number;
  onPaid: (payments: Payment[], change: number) => void;
  onCancel: () => void;
}) {
  const [tenders, setTenders] = useState<AddedTender[]>([]);
  const remaining = useMemo(
    () => round2(total - tenders.reduce((s, t) => s + t.amount, 0)),
    [total, tenders],
  );
  const [amountStr, setAmountStr] = useState(() => toInput(total));

  // Estado da captura de cartão em andamento.
  const [pending, setPending] = useState<{
    instrument: PaymentInstrument;
    amount: number;
    label: string;
  } | null>(null);
  const [snapshot, setSnapshot] = useState<PaymentSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MockOutcome>(getMockOutcome());

  const state = snapshot?.state;
  const processing = busy && (state === "in_progress" || state === "pending");
  const timedOut = state === "timeout";
  const idle = !processing && !timedOut && !error;

  // O digitado. Cartão/PIX não passam do que falta; dinheiro pode passar (troco).
  const typed = parseAmount(amountStr);
  const charge = Math.min(typed, remaining);
  // Troco só existe quando o dinheiro recebido cobre tudo o que falta.
  const cashChange = typed > remaining ? round2(typed - remaining) : 0;

  // Adiciona um tender liquidado; se cobrir o total, finaliza a venda (com troco).
  const settle = useCallback(
    (method: PaymentMethod, amount: number, label: string, change = 0) => {
      const next = [...tenders, { method, amount, label }];
      const covered = isFullyPaid(
        total,
        next.map((t) => ({ amount: t.amount, approved: true })),
      );
      if (covered) {
        onPaid(
          next.map((t) => ({ method: t.method, amount: t.amount })),
          change,
        );
        return;
      }
      setTenders(next);
      setAmountStr(
        toInput(round2(total - next.reduce((s, t) => s + t.amount, 0))),
      );
      setSnapshot(null);
      setPending(null);
      setError(null);
    },
    [tenders, total, onPaid],
  );

  const payCash = useCallback(() => {
    if (charge <= 0) return;
    // O tender registrado é o que falta (o que entra na venda); o excedente é troco.
    settle("DINHEIRO", charge, "Dinheiro", cashChange);
  }, [charge, cashChange, settle]);

  const payWith = useCallback(
    async (instrument: PaymentInstrument, label: string) => {
      if (charge <= 0) return;
      setPending({ instrument, amount: charge, label });
      setError(null);
      setBusy(true);
      try {
        const result = await capturePayment(
          { amount: charge, instrument },
          { onSnapshot: setSnapshot },
        );
        if (result.state === "approved") {
          settle(instrumentToMethod(instrument), charge, label);
        } else if (result.state !== "timeout") {
          setError(result.message ?? "Pagamento não aprovado.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no pagamento.");
      } finally {
        setBusy(false);
      }
    },
    [charge, settle],
  );

  const reconcile = useCallback(async () => {
    if (!snapshot || !pending) return;
    setBusy(true);
    try {
      const result = await reconcilePayment(snapshot.id);
      setSnapshot(result);
      if (result.state === "approved") {
        settle(
          instrumentToMethod(pending.instrument),
          pending.amount,
          pending.label,
        );
      } else {
        setError(result.message ?? "Pagamento recusado na reconciliação.");
      }
    } finally {
      setBusy(false);
    }
  }, [snapshot, pending, settle]);

  const backToChoice = useCallback(() => {
    setSnapshot(null);
    setPending(null);
    setError(null);
  }, []);

  const chooseOutcome = (value: MockOutcome) => {
    setMockOutcome(value);
    setOutcome(value);
  };

  // Atalhos: Esc cancela; 1 = dinheiro; 2/3/4 = cartão/PIX (fora do campo de valor).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (!idle || busy || e.target instanceof HTMLInputElement) return;
      if (e.key === "1") payCash();
      const found = INSTRUMENTS.find((i) => i.hotkey === e.key);
      if (found) void payWith(found.instrument, found.label);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idle, busy, onCancel, payCash, payWith]);

  return (
    <div className="pay-overlay">
      <div className="pay-modal">
        <div className="pay-head">
          <span>Pagamento</span>
          <strong>{brl(total)}</strong>
        </div>

        {tenders.length > 0 && (
          <ul className="pay-tenders">
            {tenders.map((t, i) => (
              <li key={`${t.label}-${i}`}>
                <span>{t.label}</span>
                <span>{brl(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        {idle && (
          <>
            <div className="pay-remaining">
              <span>Falta receber</span>
              <strong>{brl(remaining)}</strong>
            </div>

            <label className="pay-amount">
              <span className="muted small">Valor recebido</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAmountStr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </label>

            {cashChange > 0 && (
              <div className="pay-change">
                <span>Troco (dinheiro)</span>
                <strong>{brl(cashChange)}</strong>
              </div>
            )}

            <div className="pay-methods">
              <button
                type="button"
                className="btn primary pay-method"
                disabled={charge <= 0}
                onClick={payCash}
              >
                <span className="pay-key">1</span> Dinheiro
              </button>
              {INSTRUMENTS.map((i) => (
                <button
                  key={i.instrument}
                  type="button"
                  className="btn pay-method"
                  disabled={charge <= 0}
                  onClick={() => void payWith(i.instrument, i.label)}
                >
                  <span className="pay-key">{i.hotkey}</span> {i.label}
                </button>
              ))}
            </div>

            <div className="pay-sim">
              <span className="muted small">Simulação (mock):</span>
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`chip ${outcome === o.value ? "on" : ""}`}
                  onClick={() => chooseOutcome(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <button type="button" className="btn ghost" onClick={onCancel}>
              Cancelar (Esc)
            </button>
          </>
        )}

        {processing && (
          <div className="pay-status">
            <div className="spinner" />
            <p>Processando na maquininha…</p>
            <span className="muted small">
              {pending ? `${pending.label} · ${brl(pending.amount)}` : ""}
            </span>
          </div>
        )}

        {timedOut && (
          <div className="pay-status warn">
            <p>
              <strong>Sem resposta da maquininha.</strong>
            </p>
            <span className="muted small">
              Não sabemos se o pagamento foi feito — não conclua às cegas.
              Reconcilie para descobrir o resultado real.
            </span>
            <div className="pay-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => void reconcile()}
              >
                {busy ? "Reconciliando…" : "Reconciliar"}
              </button>
              <button type="button" className="btn ghost" onClick={onCancel}>
                Cancelar venda
              </button>
            </div>
          </div>
        )}

        {error && !processing && !timedOut && (
          <div className="pay-status err">
            <p>{error}</p>
            <div className="pay-actions">
              <button type="button" className="btn" onClick={backToChoice}>
                Tentar outra forma
              </button>
              <button type="button" className="btn ghost" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
