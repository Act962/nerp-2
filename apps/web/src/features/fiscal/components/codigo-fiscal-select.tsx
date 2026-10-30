"use client";

import type { ItemTabela } from "@nerp/fiscal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// O Radix não aceita item com value "" — o vazio ganha um sentinela.
const VAZIO = "__vazio__";

interface CodigoFiscalSelectProps {
  id?: string;
  tabela: readonly ItemTabela[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Texto da opção vazia, ex.: "Usar padrão da empresa (102)". */
  rotuloVazio?: string;
  disabled?: boolean;
}

/**
 * Select de código fiscal com a descrição ao lado ("102 — Tributada sem
 * permissão de crédito"): quem não é da área reconhece o que está escolhendo.
 * Um código salvo que não está no recorte da tabela continua aparecendo, para
 * a tela nunca apagar em silêncio o que o contador cadastrou.
 */
export function CodigoFiscalSelect({
  id,
  tabela,
  value,
  onChange,
  rotuloVazio = "Não informado",
  disabled,
}: CodigoFiscalSelectProps) {
  const foraDaTabela = value && !tabela.some((i) => i.codigo === value);
  return (
    <Select
      value={value || VAZIO}
      onValueChange={(v) => onChange(v === VAZIO ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={VAZIO}>
          <span className="text-muted-foreground">{rotuloVazio}</span>
        </SelectItem>
        {foraDaTabela && (
          <SelectItem value={value}>{value} — código cadastrado</SelectItem>
        )}
        {tabela.map((item) => (
          <SelectItem key={item.codigo} value={item.codigo}>
            <span className="font-mono">{item.codigo}</span> — {item.descricao}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
