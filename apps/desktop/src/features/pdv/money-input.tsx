import { forwardRef } from "react";
import { formatCents } from "./money";

/**
 * Campo de dinheiro com máscara estilo calculadora: o estado é o valor em
 * CENTAVOS (inteiro) e cada dígito entra pela direita — nada além de dígito é
 * aceito (letra/símbolo é impossível). Digitar `234500` percorre
 * 0,02 → 0,23 → 2,34 → 23,45 → 234,50 → 2.345,00; Backspace desfaz pela direita.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    cents: number;
    onCents: (cents: number) => void;
    autoFocus?: boolean;
    ariaLabel?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  }
>(function MoneyInput(
  { cents, onCents, autoFocus, ariaLabel, onKeyDown },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={formatCents(cents)}
      // biome-ignore lint/a11y/noAutofocus: caixa é teclado-first
      autoFocus={autoFocus}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        // Só os dígitos importam; pontos/vírgula vêm da formatação. Cap em 11.
        const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
        onCents(digits ? Number.parseInt(digits, 10) : 0);
      }}
      onKeyDown={onKeyDown}
    />
  );
});
