// Ordenação canônica do ranking, num só lugar: por percentual de meta e, no
// empate (sem meta cadastrada `percentAchieved` é null pra todos), pelo valor
// vendido. O board e a detecção de troca de top 3 usam este mesmo comparador
// pra nunca divergirem.

interface RankOrderFields {
  id: string;
  percentAchieved: number | null;
  achievedAmount: number | null;
}

export function compareRankEntries(
  a: RankOrderFields,
  b: RankOrderFields,
): number {
  return (
    (b.percentAchieved ?? -1) - (a.percentAchieved ?? -1) ||
    (b.achievedAmount ?? 0) - (a.achievedAmount ?? 0)
  );
}

// IDs das N primeiras posições, em ordem. Não muta o array recebido.
export function topRankEntryIds<T extends RankOrderFields>(
  entries: T[],
  n = 3,
): string[] {
  return [...entries]
    .sort(compareRankEntries)
    .slice(0, n)
    .map((entry) => entry.id);
}
