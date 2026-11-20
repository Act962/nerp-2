// Cubagem a partir das medidas que o cadastro já guarda em milímetros e
// gramas. Os campos legados (`weight`, `length`…) misturam unidades e ficam de
// fora de propósito.

export type MedidasDoProduto = {
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  grossWeightG: number | null;
  packQty: number | null;
  packWidthMm: number | null;
  packHeightMm: number | null;
  packDepthMm: number | null;
};

export type Volume = {
  larguraCm: number;
  alturaCm: number;
  profundidadeCm: number;
  m3: number;
};

export type Cubagem = {
  unidade: Volume | null;
  pesoUnidadeKg: number | null;
  caixa: (Volume & { quantidade: number }) | null;
  /** Peso da caixa estimado pelas unidades — o cadastro não tem o peso da embalagem. */
  pesoCaixaKg: number | null;
};

function volume(
  larguraMm: number | null,
  alturaMm: number | null,
  profundidadeMm: number | null,
): Volume | null {
  if (!larguraMm || !alturaMm || !profundidadeMm) return null;
  return {
    larguraCm: larguraMm / 10,
    alturaCm: alturaMm / 10,
    profundidadeCm: profundidadeMm / 10,
    m3: (larguraMm * alturaMm * profundidadeMm) / 1e9,
  };
}

export function calcularCubagem(medidas: MedidasDoProduto): Cubagem {
  const unidade = volume(medidas.widthMm, medidas.heightMm, medidas.depthMm);
  const pesoUnidadeKg = medidas.grossWeightG
    ? medidas.grossWeightG / 1000
    : null;
  const quantidade =
    medidas.packQty && medidas.packQty > 1 ? medidas.packQty : null;
  const volumeCaixa = volume(
    medidas.packWidthMm,
    medidas.packHeightMm,
    medidas.packDepthMm,
  );
  return {
    unidade,
    pesoUnidadeKg,
    caixa: quantidade && volumeCaixa ? { ...volumeCaixa, quantidade } : null,
    pesoCaixaKg:
      quantidade && pesoUnidadeKg ? pesoUnidadeKg * quantidade : null,
  };
}

export function temCubagem(cubagem: Cubagem): boolean {
  return Boolean(cubagem.unidade || cubagem.caixa || cubagem.pesoUnidadeKg);
}
