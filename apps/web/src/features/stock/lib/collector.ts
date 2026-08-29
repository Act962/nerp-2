import type { CollectorOperation } from "../hooks/use-collector";

export const OPERATION_LABEL: Record<CollectorOperation, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  INVENTARIO: "Inventário",
};

/**
 * O que o campo de quantidade significa em cada operação.
 *
 * Em entrada e saída o número é QUANTO MOVEU; em inventário é QUANTO EXISTE na
 * prateleira. Trocar os dois é o erro clássico de coletor, e é por isso que o
 * rótulo muda junto com a operação em vez de ficar um genérico "quantidade".
 */
export const QUANTITY_LABEL: Record<CollectorOperation, string> = {
  ENTRADA: "Quantidade que entrou",
  SAIDA: "Quantidade que saiu",
  INVENTARIO: "Quantidade contada na prateleira",
};

export interface StockPreview {
  /** Saldo depois da operação. */
  newStock: number;
  /** Diferença aplicada ao saldo (negativa quando reduz). */
  difference: number;
  /** Operação inválida — o motivo aparece na tela e trava o botão. */
  error?: string;
}

/**
 * Prévia do saldo antes de confirmar. Existe para o operador ver o resultado
 * ANTES de gravar: no chão da loja, descobrir o engano depois vira um segundo
 * movimento de correção e um histórico sujo.
 */
export function previewStock(
  operation: CollectorOperation,
  currentStock: number,
  quantity: number,
): StockPreview {
  if (!Number.isFinite(quantity)) {
    return {
      newStock: currentStock,
      difference: 0,
      error: "Informe a quantidade",
    };
  }

  if (operation === "INVENTARIO") {
    if (quantity < 0) {
      return {
        newStock: currentStock,
        difference: 0,
        error: "A contagem não pode ser negativa",
      };
    }
    return { newStock: quantity, difference: quantity - currentStock };
  }

  if (quantity <= 0) {
    return {
      newStock: currentStock,
      difference: 0,
      error: "A quantidade precisa ser maior que zero",
    };
  }

  if (operation === "ENTRADA") {
    return { newStock: currentStock + quantity, difference: quantity };
  }

  const newStock = currentStock - quantity;
  if (newStock < 0) {
    return {
      newStock: currentStock,
      difference: 0,
      // O servidor também recusa; barrar aqui evita a viagem e a mensagem seca.
      error: `Estoque insuficiente: há ${currentStock} em estoque`,
    };
  }
  return { newStock, difference: -quantity };
}
