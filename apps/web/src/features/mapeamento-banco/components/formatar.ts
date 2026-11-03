import type { StatusDoTipo } from "../application/resolver-tipo";
import type { ValorCru } from "../domain/converter";
import { ehTabelaGrande } from "../domain/estrutura";

const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const inteiro = new Intl.NumberFormat("pt-BR");

/** "24 mil", "17 mi" — a lista de tabelas só precisa da ordem de grandeza. */
export function linhasCompactas(linhas: number | null): string {
  return linhas === null ? "—" : compacto.format(linhas);
}

export function linhasPorExtenso(linhas: number | null): string {
  return linhas === null
    ? "sem estatística"
    : `${inteiro.format(linhas)} linhas`;
}

export function tabelaGrande(linhas: number | null): boolean {
  return ehTabelaGrande({ linhas });
}

/** Valor de célula para a grade: data legível, nulo explícito. */
export function textoDaCelula(valor: ValorCru): string {
  if (valor === null) return "NULL";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}T/.test(valor)) {
    // Data do ERP vem sem fuso (ver `dataSemFuso`): só troca o "T" e esconde
    // a meia-noite. O "Z" fica só para valor que já chegou com fuso.
    return valor
      .replace("T", " ")
      .replace(/\.000(?=Z$)/, "")
      .replace(/ 00:00:00$/, "");
  }
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  return String(valor);
}

export const ROTULO_DO_STATUS: Record<StatusDoTipo, string> = {
  pronto: "Pronto",
  incompleto: "Incompleto",
  indisponivel: "Indisponível",
  desligado: "Desligado",
};

/** Cor por token semântico, igual nos dois temas. */
export const COR_DO_STATUS: Record<StatusDoTipo, string> = {
  pronto: "bg-emerald-500",
  incompleto: "bg-amber-500",
  indisponivel: "bg-destructive",
  desligado: "bg-muted-foreground/40",
};
