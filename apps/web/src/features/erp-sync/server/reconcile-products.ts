// Reconciliação entre o cadastro do ERP e o cadastro local — lógica PURA.
//
// Sem prisma e sem Oracle de propósito: criar produto é a parte irreversível
// deste sync (um casamento errado polui a base com milhares de linhas), então a
// decisão precisa ser testável sem tocar em banco nenhum.
//
// O casamento é por CÓDIGO DE BARRAS. É a única chave com
// `@@unique([organizationId, barcode])` no schema — SKU tem o unique comentado,
// então casar por ele poderia atingir mais de uma linha.

import type { ExternalProductDTO } from "./connectors/types";

/** Produto local, no mínimo necessário para reconciliar. */
export interface LocalProductRef {
  id: string;
  barcode: string | null;
}

export interface ReconcileResult {
  /** Já existe no cadastro: só o status do ERP é atualizado. */
  toUpdate: { id: string; erpActive: boolean; erpCode: string }[];
  /** Não existe: será criado. */
  toCreate: ExternalProductDTO[];
  /** Sem EAN utilizável — não dá para casar nem criar com segurança. */
  skippedNoBarcode: ExternalProductDTO[];
  /**
   * Tem código, mas não é código de barras de varejo — o ERP repete o código
   * interno no campo de EAN quando o produto não tem etiqueta. Não vira produto
   * novo; se já existir um local com esse mesmo código, ainda casa.
   */
  skippedInvalidBarcode: ExternalProductDTO[];
  /** EAN repetido dentro do próprio retorno do ERP: só o primeiro vale. */
  duplicatesInSource: ExternalProductDTO[];
}

/** Só dígitos. EAN vem com espaço, ponto e zero à esquerda dependendo do ERP. */
export function normalizeBarcode(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  // Um "0" ou "" no cadastro significa SEM código, não código zero.
  return /^0*$/.test(digits) ? "" : digits;
}

/**
 * Comprimentos de código de barras de varejo: EAN-8, UPC-A, EAN-13, DUN-14.
 * Não existe padrão de 9, 10 ou 11 dígitos — código com outro tamanho é
 * numeração interna do ERP, não etiqueta.
 */
const RETAIL_BARCODE_LENGTHS = new Set([8, 12, 13, 14]);

export function isRetailBarcode(digits: string): boolean {
  return RETAIL_BARCODE_LENGTHS.has(digits.length);
}

export function reconcileProducts(
  external: readonly ExternalProductDTO[],
  local: readonly LocalProductRef[],
): ReconcileResult {
  const localByBarcode = new Map<string, LocalProductRef>();
  for (const p of local) {
    const key = normalizeBarcode(p.barcode);
    // O primeiro vence: o unique do banco impede empate real, mas normalizar
    // pode colidir (ex.: "007" e "7") e o sync não pode escolher ao acaso.
    if (key && !localByBarcode.has(key)) localByBarcode.set(key, p);
  }

  const out: ReconcileResult = {
    toUpdate: [],
    toCreate: [],
    skippedNoBarcode: [],
    skippedInvalidBarcode: [],
    duplicatesInSource: [],
  };
  const vistos = new Set<string>();

  for (const item of external) {
    const key = normalizeBarcode(item.barcode);
    if (!key) {
      out.skippedNoBarcode.push(item);
      continue;
    }
    if (vistos.has(key)) {
      out.duplicatesInSource.push(item);
      continue;
    }
    vistos.add(key);

    const hit = localByBarcode.get(key);
    if (hit) {
      // Casa por dígito exato, sem julgar o formato: atualizar é idempotente e
      // não cria linha nenhuma, então recusar um casamento só perderia status.
      out.toUpdate.push({
        id: hit.id,
        erpActive: item.isActive,
        erpCode: item.externalCode,
      });
    } else if (isRetailBarcode(key)) {
      out.toCreate.push(item);
    } else {
      // Criar aqui gravaria um código interno no `barcode`, que é único por
      // organização — ocuparia o lugar do EAN de verdade quando ele chegasse.
      out.skippedInvalidBarcode.push(item);
    }
  }

  return out;
}
