import {
  isFullyPaid,
  type MockOutcome,
  type PaymentInstrument,
  type PaymentSnapshot,
} from "@nerp/core";
import type { PaymentMethod } from "@nerp/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  capturePayment,
  getMockOutcome,
  instrumentToMethod,
  reconcilePayment,
  setMockOutcome,
} from "../../lib/payment";
import { MoneyInput } from "./money-input";
import { toCents } from "./money";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Um pagamento já liquidado nesta venda (dinheiro manual ou cartão aprovado). */
type AddedTender = { method: PaymentMethod; amount: number; label: string };
type Payment = { method: PaymentMethod; amount: number };

/** As formas na ordem dos atalhos (1..4). Dinheiro abre o passo de valor (troco). */
type Method =
  | { key: "1"; label: "Dinheiro"; kind: "cash" }
  | { key: "2"; label: "Crédito"; kind: "card"; instrument: PaymentInstrument }
  | { key: "3"; label: "Débito"; kind: "card"; instrument: PaymentInstrument }
  | { key: "4"; label: "PIX"; kind: "card"; instrument: PaymentInstrument };

const METHODS: Method[] = [
  { key: "1", label: "Dinheiro", kind: "cash" },
  { key: "2", label: "Crédito", kind: "card", instrument: "credit" },
  { key: "3", label: "Débito", kind: "card", instrument: "debit" },
  { key: "4", label: "PIX", kind: "card", instrument: "pix" },
];

const OUTCOMES: { value: MockOutcome; label: string }[] = [
  { value: "approve", label: "Aprovar" },
  { value: "decline", label: "Recusar" },
  { value: "timeout", label: "Timeout" },
];

/**
 * Passo de pagamento do PDV — teclado-first, SEM ambiguidade.
 *
 * O foco fica PRESO no modal (nada vaza pro campo de leitura atrás). O fluxo é
 * "método primeiro, valor depois": `1..4` (ou ↑↓ + Enter) escolhem a forma;
 * Dinheiro abre o campo "Valor recebido" (onde dígito = valor, sem colidir com
 * os atalhos) e Enter confirma com troco; cartão/PIX processam na hora. `Esc`
 * sobe um nível (do valor → métodos; dos métodos → cancela a venda).
 *
 * Pagamento MISTO: acumula tenders; a venda só finaliza (`onPaid`) quando os
 * aprovados cobrem o total. `timeout` NÃO finaliza às cegas — oferece Reconciliar.
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

  // Passo do fluxo: escolher forma × informar o valor recebido (dinheiro).
  const [step, setStep] = useState<"choose" | "cash">("choose");
  const [highlight, setHighlight] = useState(0);
  // Valor recebido em CENTAVOS (inteiro) — máscara de moeda estilo calculadora:
  // cada dígito entra pela direita, nada além de dígito é aceito.
  const [cents, setCents] = useState(() => toCents(total));

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

  const chooseRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const state = snapshot?.state;
  const processing = busy && (state === "in_progress" || state === "pending");
  const timedOut = state === "timeout";
  const choosing = !processing && !timedOut && !error && step === "choose";
  const inCash = !processing && !timedOut && !error && step === "cash";

  // O digitado no passo dinheiro. Cartão/PIX cobram o que falta (sem troco).
  const typed = cents / 100;
  const charge = Math.min(typed, remaining);
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
      const left = round2(total - next.reduce((s, t) => s + t.amount, 0));
      setTenders(next);
      setCents(toCents(left));
      setSnapshot(null);
      setPending(null);
      setError(null);
      setStep("choose");
      setHighlight(0);
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
      const amount = remaining;
      if (amount <= 0) return;
      setPending({ instrument, amount, label });
      setError(null);
      setBusy(true);
      try {
        const result = await capturePayment(
          { amount, instrument },
          { onSnapshot: setSnapshot },
        );
        if (result.state === "approved") {
          settle(instrumentToMethod(instrument), amount, label);
        } else if (result.state !== "timeout") {
          setError(result.message ?? "Pagamento não aprovado.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no pagamento.");
      } finally {
        setBusy(false);
      }
    },
    [remaining, settle],
  );

  // Escolhe uma forma pelo objeto (clique ou atalho): dinheiro abre o valor.
  const pick = useCallback(
    (m: Method) => {
      if (m.kind === "cash") {
        setCents(toCents(remaining));
        setStep("cash");
        return;
      }
      void payWith(m.instrument, m.label);
    },
    [remaining, payWith],
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
    setStep("choose");
  }, []);

  const chooseOutcome = (value: MockOutcome) => {
    setMockOutcome(value);
    setOutcome(value);
  };

  // Foco preso no modal: escolha foca a lista; dinheiro foca o valor. Isso é o
  // que impede os dígitos de vazarem pro campo de leitura atrás.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reposiciona o foco a cada troca de passo/estado
  useEffect(() => {
    if (choosing) chooseRef.current?.focus();
    else if (inCash) amountRef.current?.select();
  }, [choosing, inCash, processing, timedOut, error]);

  // Atalhos da ESCOLHA: 1..4 selecionam; ↑↓ navegam; Enter confirma; Esc cancela.
  useEffect(() => {
    if (!choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, METHODS.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        pick(METHODS[highlight]);
        return;
      }
      const byKey = METHODS.find((m) => m.key === e.key);
      if (byKey) {
        e.preventDefault();
        setHighlight(METHODS.indexOf(byKey));
        pick(byKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosing, highlight, pick, onCancel]);

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

        <div className="pay-remaining">
          <span>Falta receber</span>
          <strong>{brl(remaining)}</strong>
        </div>

        {choosing && (
          <div className="pay-choose" ref={chooseRef} tabIndex={-1}>
            <div className="pay-methods">
              {METHODS.map((m, i) => (
                <button
                  key={m.key}
                  type="button"
                  className={`btn pay-method ${m.kind === "cash" ? "primary" : ""} ${i === highlight ? "active" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(m)}
                >
                  <span className="pay-key">{m.key}</span> {m.label}
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
          </div>
        )}

        {inCash && (
          <div className="pay-cash">
            <div className="pay-amount">
              <span className="muted small">Valor recebido</span>
              <MoneyInput
                ref={amountRef}
                cents={cents}
                onCents={setCents}
                autoFocus
                ariaLabel="Valor recebido"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    payCash();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    backToChoice();
                  }
                }}
              />
            </div>

            <div className={`pay-change ${cashChange > 0 ? "" : "muted"}`}>
              <span>Troco</span>
              <strong className="tnum">{brl(cashChange)}</strong>
            </div>

            <div className="pay-actions">
              <button
                type="button"
                className="btn primary"
                disabled={charge <= 0}
                onClick={payCash}
              >
                Confirmar · Enter
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={backToChoice}
              >
                Voltar (Esc)
              </button>
            </div>
          </div>
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
