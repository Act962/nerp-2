/** "2h 35min" — vazio vira "—" para não exibir "0min" como se fosse medida. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

/**
 * "há 2h 10min" — a idade de uma posição.
 *
 * Um pino de "onde a pessoa está" sem a idade ao lado é a mesma coisa que uma
 * afirmação falsa quando o registro é de anteontem.
 */
export function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "agora há pouco";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return days === 1 ? "há 1 dia" : `há ${days} dias`;
  return `há ${formatDuration(ms)}`;
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
