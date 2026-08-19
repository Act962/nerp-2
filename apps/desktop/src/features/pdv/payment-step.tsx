import type {
  MockOutcome,
  PaymentInstrument,
  PaymentSnapshot,
} from "@nerp/core";
import type { PaymentMethod } from "@nerp/types";
import { useCallback, useEffect, useState } from "react";
import {
  capturePayment,
  getMockOutcome,
  instrumentToMethod,
  reconcilePayment,
  setMockOutcome,
} from "../../lib/payment";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
 * Passo de pagamento do PDV (corte 2). Uma forma por venda (MVP).
 *
 * Dinheiro é tender manual (aprovado na hora). Cartão/PIX passam pelo
 * `PaymentProcessor` (hoje o Mock): inicia → `capturePayment` faz o polling e a
 * UI reflete processando/aprovado/recusado/erro/timeout. Em `timeout` a venda
 * NÃO finaliza (não assume pago nem não-pago) — oferece Reconciliar.
 */
export function PaymentStep({
  total,
  onPaid,
  onCancel,
}: {
  total: number;
  onPaid: (payments: Payment[]) => void;
  onCancel: () => void;
}) {
  const [instrument, setInstrument] = useState<PaymentInstrument | null>(null);
  const [snapshot, setSnapshot] = useState<PaymentSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MockOutcome>(getMockOutcome());

  const state = snapshot?.state;
  const processing = busy && (state === "in_progress" || state === "pending");
  const timedOut = state === "timeout";

  const payCash = useCallback(() => {
    onPaid([{ method: "DINHEIRO", amount: total }]);
  }, [onPaid, total]);

  const payWith = useCallback(
    async (chosen: PaymentInstrument) => {
      setInstrument(chosen);
      setError(null);
      setBusy(true);
      try {
        const result = await capturePayment(
          { amount: total, instrument: chosen },
          { onSnapshot: setSnapshot },
        );
        if (result.state === "approved") {
          onPaid([{ method: instrumentToMethod(chosen), amount: total }]);
        } else if (result.state !== "timeout") {
          setError(result.message ?? "Pagamento não aprovado.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no pagamento.");
      } finally {
        setBusy(false);
      }
    },
    [onPaid, total],
  );

  const reconcile = useCallback(async () => {
    if (!snapshot || !instrument) return;
    setBusy(true);
    try {
      const result = await reconcilePayment(snapshot.id);
      setSnapshot(result);
      if (result.state === "approved") {
        onPaid([{ method: instrumentToMethod(instrument), amount: total }]);
      } else {
        setError(result.message ?? "Pagamento recusado na reconciliação.");
      }
    } finally {
      setBusy(false);
    }
  }, [snapshot, instrument, onPaid, total]);

  const backToChoice = useCallback(() => {
    setSnapshot(null);
    setInstrument(null);
    setError(null);
  }, []);

  const chooseOutcome = (value: MockOutcome) => {
    setMockOutcome(value);
    setOutcome(value);
  };

  // Atalhos de teclado: Esc cancela; 1 = dinheiro; 2/3/4 = cartão/PIX (na escolha).
  const idle = !processing && !timedOut && !error;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (!idle || busy) return;
      if (e.key === "1") void payCash();
      const found = INSTRUMENTS.find((i) => i.hotkey === e.key);
      if (found) void payWith(found.instrument);
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

        {idle && (
          <>
            <div className="pay-methods">
              <button
                type="button"
                className="btn primary pay-method"
                onClick={payCash}
              >
                <span className="pay-key">1</span> Dinheiro
              </button>
              {INSTRUMENTS.map((i) => (
                <button
                  key={i.instrument}
                  type="button"
                  className="btn pay-method"
                  onClick={() => void payWith(i.instrument)}
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
            <span className="muted small">Aguardando aprovação</span>
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
