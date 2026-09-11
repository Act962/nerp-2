"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A janela dos dois painéis do dono da plataforma.
 *
 * Fica em `nuqs`? Não: o período não vale um endereço compartilhável aqui — a
 * tela é de uma pessoa só, e o estado some no recarregamento de propósito,
 * para o painel sempre abrir no recorte padrão.
 */

export const PERIODOS = [7, 30, 90] as const;

export const PERIODO_PADRAO = 30;

export function rotuloDoPeriodo(dias: number) {
  if (dias === 7) return "últimos 7 dias";
  if (dias === 90) return "últimos 90 dias";
  return `últimos ${dias} dias`;
}

export function SeletorDePeriodo({
  dias,
  onChange,
}: {
  dias: number;
  onChange: (dias: number) => void;
}) {
  return (
    <Select value={String(dias)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODOS.map((opcao) => (
          <SelectItem key={opcao} value={String(opcao)}>
            {rotuloDoPeriodo(opcao)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "há 3 dias", a partir de um ISO. O painel não precisa de hora cheia. */
export function desde(iso: string) {
  const dias = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}
