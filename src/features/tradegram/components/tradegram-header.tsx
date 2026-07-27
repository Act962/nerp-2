import { constructUrl } from "@/hooks/use-construct-url";
import { StatRow, type StatItem } from "./stat-row";

interface TradeGramHeaderProps {
  logoKey?: string | null;
  name: string;
  handle: string;
  subtitle?: string | null;
  stats: StatItem[];
}

// Cabeçalho do perfil (grupo ou loja): avatar com anel gradiente estilo
// Instagram, nome, @handle e a fileira de estatísticas. Reutilizado nos dois
// níveis do TradeGram.
export function TradeGramHeader({
  logoKey,
  name,
  handle,
  subtitle,
  stats,
}: TradeGramHeaderProps) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (
    words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)
  ).toUpperCase();

  return (
    <header className="flex items-start gap-4 px-4 pt-6 pb-4">
      <div className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-500 p-[3px]">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-background">
          {logoKey ? (
            // biome-ignore lint/performance/noImgElement: logo por key do R2
            <img
              src={constructUrl(logoKey)}
              alt={name}
              className="size-full object-cover"
            />
          ) : (
            <span className="font-bold text-2xl text-muted-foreground">
              {initials}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-bold text-xl leading-none">{name}</h1>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
            {handle}
          </span>
        </div>
        {subtitle && (
          <p className="text-muted-foreground text-sm leading-tight">
            {subtitle}
          </p>
        )}
        <div className="pt-1">
          <StatRow items={stats} />
        </div>
      </div>
    </header>
  );
}
