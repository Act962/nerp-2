import { formatBRL } from "@/utils/currency-formatter";

export { formatBRL };

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function formatarDiasSemComprar(dias: number | null): string {
  if (dias === null) return "Nunca comprou";
  if (dias === 0) return "Comprou hoje";
  if (dias === 1) return "Comprou ontem";
  return `${dias} dias sem comprar`;
}

export const STATUS_PEDIDO: Record<
  string,
  { rotulo: string; tom: "neutro" | "aviso" | "ok" | "fim" | "erro" }
> = {
  DRAFT: { rotulo: "Orçamento", tom: "neutro" },
  PENDING_APPROVAL: { rotulo: "Em aprovação", tom: "aviso" },
  CONFIRMED: { rotulo: "Aprovado", tom: "ok" },
  PROCESSING: { rotulo: "Em processamento", tom: "ok" },
  COMPLETED: { rotulo: "Faturado", tom: "fim" },
  CANCELLED: { rotulo: "Cancelado", tom: "erro" },
};

export const TIPO_PEDIDO: Record<string, string> = {
  VENDA: "Venda",
  ORCAMENTO: "Orçamento",
  BONIFICACAO: "Bonificação",
  TROCA: "Troca",
};

export const DIAS_DA_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Link do WhatsApp com o telefone normalizado (só dígitos, com DDI). */
export function linkWhatsapp(telefone: string, texto?: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
  const query = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${comDdi}${query}`;
}

export function linkComoChegar(destino: {
  latitude?: number | null;
  longitude?: number | null;
  endereco?: string | null;
}): string | null {
  if (destino.latitude != null && destino.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${destino.latitude},${destino.longitude}`;
  }
  if (destino.endereco) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino.endereco)}`;
  }
  return null;
}
