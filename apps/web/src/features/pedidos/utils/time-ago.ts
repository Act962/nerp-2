const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// "há 5 min", "há 2 h", "há 3 dias" — pedido de catálogo vive de minutos a
// dias, então o formato curto de cronômetro da cozinha ("49h") não serve.
export function formatTimeAgo(iso: string, now: number): string {
  const elapsedMs = Math.max(0, now - new Date(iso).getTime());
  if (elapsedMs < MINUTE_MS) return "agora";
  if (elapsedMs < HOUR_MS) return `há ${Math.floor(elapsedMs / MINUTE_MS)} min`;
  if (elapsedMs < DAY_MS) return `há ${Math.floor(elapsedMs / HOUR_MS)} h`;
  const days = Math.floor(elapsedMs / DAY_MS);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}
