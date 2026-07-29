"use client";

import { AlertTriangle, Zap } from "lucide-react";

// Opção de tabela/coluna no montador: nome de negócio grande, código técnico do
// Winthor pequeno embaixo, explicação no hover.
//
// O hover usa `title` nativo de propósito. Um Tooltip do Radix dentro de um
// SelectItem do Radix disputa os mesmos eventos de ponteiro e fica intermitente;
// `title` é chato de estilizar mas funciona sempre — inclusive com teclado.

export function OracleTermOption({
  code,
  label,
  description,
  leadingIndex,
  indexed,
}: {
  code: string;
  label: string;
  description?: string;
  /** Só faz sentido em coluna: marca se a busca por ela é rápida. */
  leadingIndex?: boolean;
  indexed?: boolean;
}) {
  // Sem tradução no glossário, o código já é o rótulo — não repete embaixo.
  const traduzido = label !== code;

  return (
    <span
      className="flex flex-col leading-tight"
      title={description || undefined}
    >
      <span className="flex items-center gap-1">
        {label}
        {leadingIndex ? (
          <Zap className="size-3 shrink-0 text-emerald-500" />
        ) : indexed === false ? (
          <AlertTriangle className="size-3 shrink-0 text-amber-500" />
        ) : null}
      </span>
      {(traduzido || description) && (
        <span className="text-[9px] text-muted-foreground">
          {traduzido && code}
          {traduzido && description && " · "}
          {description && description.length > 58
            ? `${description.slice(0, 58)}…`
            : description}
        </span>
      )}
    </span>
  );
}
