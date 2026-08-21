import {
  isFullyPaid,
  type MockOutcome,
  type PaymentInstrument,
  type PaymentSnapshot,
} from "@nerp/core";
import type { PaymentMethod } from "@nerp/types";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  capturePayment,
  getMockOutcome,
  instrumentToMethod,
  reconcilePayment,
  setMockOutcome,
} from "../../lib/payment";
import { toCents } from "./money";
import { MoneyInput } from "./money-input";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Um pagamento já liquidado nesta venda. */
type AddedTender = { method: PaymentMethod; amount: number; label: string };
type Payment = { method: PaymentMethod; amount: number };

// ── Ícones (inline, aria-hidden) ─────────────────────────────────────────
const CashIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="2"
      y="6"
      width="20"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const CardIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="2"
      y="5"
      width="20"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M2 9h20" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const PixIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M12 3l9 9-9 9-9-9 9-9z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);
const OthersIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="6" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

/**
 * As formas na ordem dos atalhos (1..5). Manuais (dinheiro/outros) só registram
 * o valor; eletrônicas (crédito/débito/PIX) passam pelo `PaymentProcessor`
 * (captura na maquininha). Boleto/transferência não são de PDV (pagamento
 * diferido/remoto) — ficaram de fora.
 */
type Method =
  | {
      key: string;
      label: string;
      kind: "manual";
      method: PaymentMethod;
      Icon: () => ReactElement;
    }
  | {
      key: string;
      label: string;
      kind: "card";
      instrument: PaymentInstrument;
      Icon: () => ReactElement;
    };

const METHODS: Method[] = [
  {
    key: "1",
    label: "Dinheiro",
    kind: "manual",
    method: "DINHEIRO",
    Icon: CashIcon,
  },
  {
    key: "2",
    label: "Crédito",
    kind: "card",
    instrument: "credit",
    Icon: CardIcon,
  },
  {
    key: "3",
    label: "Débito",
    kind: "card",
    instrument: "debit",
    Icon: CardIcon,
  },
  { key: "4", label: "PIX", kind: "card", instrument: "pix", Icon: PixIcon },
  {
    key: "5",
    label: "Outros",
    kind: "manual",
    method: "OUTROS",
    Icon: OthersIcon,
  },
];

const isCashMethod = (m: Method | null) =>
  m?.kind === "manual" && m.method === "DINHEIRO";

const OUTCOMES: { value: MockOutcome; label: string }[] = [
  { value: "approve", label: "Aprovar" },
  { value: "decline", label: "Recusar" },
  { value: "timeout", label: "Timeout" },
];

/**
 * Passo de pagamento do PDV — teclado-first e MISTO (split-as-you-go).
 *
 * O foco fica PRESO no modal. Fluxo "forma → valor": `1..5` (ou ↑↓ + Enter)
 * escolhem a forma; abre o valor (default = o que falta, editável para dividir);
 * manuais registram na hora, eletrônicas capturam na maquininha. Os tenders
 * acumulam e a venda só finaliza (`onPaid`) quando cobrem o total — é isso que
 * dá o pagamento misto. `timeout` NÃO finaliza às cegas — oferece Reconciliar.
 * `Esc` sobe um nível; `Backspace` na escolha remove o último tender.
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

  // Passo do fluxo: escolher a forma × informar o valor.
  const [step, setStep] = useState<"choose" | "amount">("choose");
  const [highlight, setHighlight] = useState(0);
  const [active, setActive] = useState<Method | null>(null);
  // Valor em CENTAVOS (inteiro) — máscara de moeda estilo calculadora.
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
  const inAmount = !processing && !timedOut && !error && step === "amount";

  // O digitado no passo de valor. Só o Dinheiro dá troco; as demais formas
  // cobram no máximo o que falta.
  const cash = isCashMethod(active);
  const typed = cents / 100;
  const charge = Math.min(typed, remaining);
  const cashChange = cash && typed > remaining ? round2(typed - remaining) : 0;

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
      setActive(null);
      setSnapshot(null);
      setPending(null);
      setError(null);
      setStep("choose");
      setHighlight(0);
    },
    [tenders, total, onPaid],
  );

  const payWith = useCallback(
    async (instrument: PaymentInstrument, amount: number, label: string) => {
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
    [settle],
  );

  // Confirma o valor do passo atual: manual registra; eletrônica captura.
  const confirmAmount = useCallback(() => {
    if (!active || charge <= 0) return;
    if (active.kind === "manual") {
      settle(active.method, charge, active.label, cashChange);
    } else {
      void payWith(active.instrument, charge, active.label);
    }
  }, [active, charge, cashChange, settle, payWith]);

  // Escolhe uma forma (clique ou atalho): abre o passo de valor com o que falta.
  const pick = useCallback(
    (m: Method) => {
      setActive(m);
      setCents(toCents(remaining));
      setStep("amount");
    },
    [remaining],
  );

  const removeTender = useCallback((index: number) => {
    setTenders((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
    setActive(null);
    setStep("choose");
  }, []);

  const chooseOutcome = (value: MockOutcome) => {
    setMockOutcome(value);
    setOutcome(value);
  };

  // Foco preso no modal: escolha foca a lista; valor foca o campo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reposiciona o foco a cada troca de passo/estado
  useEffect(() => {
    if (choosing) chooseRef.current?.focus();
    else if (inAmount) amountRef.current?.select();
  }, [choosing, inAmount, processing, timedOut, error]);

  // Atalhos da ESCOLHA: 1..5 selecionam; ↑↓ navegam; Enter confirma; Esc cancela;
  // Backspace remove o último tender.
  useEffect(() => {
    if (!choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setTenders((prev) => prev.slice(0, -1));
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
                <span className="pay-tender-right">
                  <span className="tnum">{brl(t.amount)}</span>
                  <button
                    type="button"
                    className="pay-tender-remove"
                    aria-label={`Remover ${t.label}`}
                    onClick={() => removeTender(i)}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="pay-remaining">
          <span>Falta receber</span>
          <strong className="tnum">{brl(remaining)}</strong>
        </div>

        {choosing && (
          <div className="pay-choose" ref={chooseRef} tabIndex={-1}>
            <div className="pay-methods">
              {METHODS.map((m, i) => (
                <button
                  key={m.key}
                  type="button"
                  className={`btn pay-method ${isCashMethod(m) ? "primary" : ""} ${i === highlight ? "active" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(m)}
                >
                  <span className="pay-key">{m.key}</span>
                  <m.Icon />
                  <span className="pay-method-label">{m.label}</span>
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

        {inAmount && active && (
          <div className="pay-cash">
            <div className="pay-amount">
              <span className="muted small">
                {cash ? "Valor recebido" : `Valor · ${active.label}`}
              </span>
              <MoneyInput
                ref={amountRef}
                cents={cents}
                onCents={setCents}
                autoFocus
                ariaLabel={cash ? "Valor recebido" : `Valor ${active.label}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmAmount();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    backToChoice();
                  }
                }}
              />
            </div>

            {cash && (
              <div className={`pay-change ${cashChange > 0 ? "" : "muted"}`}>
                <span>Troco</span>
                <strong className="tnum">{brl(cashChange)}</strong>
              </div>
            )}

            <div className="pay-actions">
              <button
                type="button"
                className="btn primary"
                disabled={charge <= 0}
                onClick={confirmAmount}
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
