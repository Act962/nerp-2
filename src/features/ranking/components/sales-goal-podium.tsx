"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { SalesGoalAvatar } from "./sales-goal-avatar";

export interface SalesGoalRankEntry {
  id: string;
  externalCode: string;
  goalName: string;
  sellerName: string;
  entryKind: "SELLER" | "BUCKET";
  goalAmount: number;
  achievedAmount: number | null;
  percentAchieved: number | null;
  remainingAmount: number;
  // Ausente no payload público (ranking.publicList): a tela de TV deslogada
  // não recebe o vínculo com o Member.
  memberId?: string | null;
  photoUrl: string | null;
  achievedSource: "AUTO" | "MANUAL";
  // Também ausente no payload público — margem é estrutura de custo do cliente
  // e não sai numa URL sem login (ver `public-list.ts`). Só existe quando o
  // vendido vem de ERP externo: venda nativa do NERP não guarda custo.
  metrics?: {
    revenue: number;
    cost: number;
    margin: number;
    marginPercent: number | null;
    orders: number;
    customers: number;
    averageTicket: number | null;
  } | null;
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rankScore(entry: SalesGoalRankEntry): number {
  return Math.round(entry.percentAchieved ?? 0);
}

export const MEDALS: Record<
  number,
  { emoji: string; border: string; text: string }
> = {
  1: { emoji: "👑", border: "#ffd700", text: "#ffd700" }, // ouro
  2: { emoji: "🥈", border: "#c0c0c0", text: "#e5e7eb" }, // prata
  3: { emoji: "🥉", border: "#cd7f32", text: "#e8a060" }, // bronze
};

// Altura relativa de cada posição — degrau de pódio: 1º mais alto, 2º
// intermediário, 3º visivelmente mais baixo que o 2º.
const HEIGHT_PERCENT_BY_RANK: Record<number, number> = {
  1: 96,
  2: 78,
  3: 60,
};

function PodiumCard({
  entry,
  rank,
  showScore,
  showPercent,
  showSoldValue,
  accent,
  prize,
}: {
  entry: SalesGoalRankEntry;
  rank: number;
  showScore: boolean;
  showPercent: boolean;
  showSoldValue: boolean;
  accent: string;
  prize?: { label: string; imageUrl?: string };
}) {
  const medal = MEDALS[rank] ?? { emoji: "🚀", border: accent, text: accent };
  const isFirst = rank === 1;
  const widthPercent = isFirst ? 38 : 29;
  const heightPercent = HEIGHT_PERCENT_BY_RANK[rank] ?? 60;
  const prizeImage = prize?.imageUrl ? constructUrl(prize.imageUrl) : null;

  return (
    <div
      className="relative h-full flex flex-col items-center justify-end"
      style={{ width: `${widthPercent}%` }}
    >
      {prize && (
        <div
          className="mb-2 aspect-square w-[22%] min-w-8 sm:min-w-12 overflow-hidden rounded-full flex items-center justify-center text-center px-1 border-2 shrink-0"
          style={{
            borderColor: medal.border,
            background: `${medal.border}1f`,
            color: medal.text,
          }}
          title={prize.label}
        >
          {prizeImage ? (
            // biome-ignore lint/performance/noImgElement: chave S3 arbitrária, fora do domínio otimizado do next/image
            <img
              src={prizeImage}
              alt={prize.label}
              className="size-full object-cover"
            />
          ) : (
            <span className="text-[10px] font-bold leading-tight">
              {prize.label}
            </span>
          )}
        </div>
      )}
      <div
        className="relative w-full flex flex-col items-center pt-[6%] pb-[4%] px-2"
        style={{
          height: `${heightPercent}%`,
          clipPath:
            "polygon(50% 0%, 100% 12%, 100% 68%, 50% 100%, 0% 68%, 0% 12%)",
          background: `linear-gradient(180deg, ${medal.border}2e, ${medal.border}0d)`,
          border: `2px solid ${medal.border}`,
          animation: "salesGoalFloat 4s ease-in-out infinite",
          animationDelay: `${rank * 0.3}s`,
        }}
      >
        <span
          className="leading-none drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          style={{
            fontSize: isFirst
              ? "clamp(18px, 8vw, 34px)"
              : "clamp(14px, 6vw, 26px)",
          }}
        >
          {medal.emoji}
        </span>
        <div
          className="mt-2 rounded-full"
          style={{ boxShadow: `0 0 0 3px ${medal.border}` }}
        >
          <SalesGoalAvatar
            name={entry.sellerName}
            seed={entry.externalCode}
            photoUrl={entry.photoUrl ? constructUrl(entry.photoUrl) : null}
            size={
              isFirst ? "clamp(52px, 16vw, 104px)" : "clamp(40px, 13vw, 82px)"
            }
          />
        </div>
        <p
          className="font-bold text-center truncate max-w-full mt-2"
          style={{ color: medal.text, fontSize: isFirst ? 16 : 14 }}
        >
          {entry.goalName}
        </p>
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full font-extrabold tabular-nums mt-1.5"
          style={{
            background: `${medal.border}22`,
            color: medal.text,
            border: `1px solid ${medal.border}44`,
            fontSize: isFirst ? 14 : 12,
          }}
        >
          {showScore
            ? `✦ ${rankScore(entry)} pts`
            : formatBrl(entry.achievedAmount ?? 0)}
        </div>
        {showPercent && (
          <span
            className="text-white/60 tabular-nums mt-1"
            style={{ fontSize: isFirst ? 12 : 11 }}
          >
            {entry.percentAchieved !== null
              ? `${entry.percentAchieved.toFixed(0)}% da meta`
              : entry.goalAmount <= 0
                ? "sem meta definida"
                : "sem venda"}
          </span>
        )}
        {showSoldValue && (
          <span
            className="text-white/80 font-semibold tabular-nums mt-0.5 truncate max-w-full"
            style={{ fontSize: isFirst ? 12 : 11 }}
          >
            Vendido{" "}
            {entry.achievedAmount !== null
              ? formatBrl(entry.achievedAmount)
              : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

export function SalesGoalPodium({
  entries,
  showScore,
  showPercent,
  showSoldValue = true,
  podiumGradient = "linear-gradient(180deg, #0d0030, #050510)",
  accent = "#7a1fe7",
  prizes = [],
}: {
  entries: SalesGoalRankEntry[];
  showScore: boolean;
  showPercent: boolean;
  showSoldValue?: boolean;
  podiumGradient?: string;
  accent?: string;
  prizes?: { position: number; label: string; imageUrl?: string }[];
}) {
  const top3 = entries.slice(0, 3);
  const podium =
    top3.length >= 2 ? [top3[1], top3[0], top3[2]].filter(Boolean) : top3;
  const prizeFor = (rank: number) =>
    prizes.find((prize) => prize.position === rank);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border px-4 pt-4 pb-3 h-[420px] sm:h-[460px] lg:h-[560px] flex flex-col"
      style={{ background: podiumGradient, borderColor: `${accent}33` }}
    >
      <style>{`
        @keyframes salesGoalFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
      `}</style>
      {/* estrelas de fundo, só decorativo */}
      {Array.from({ length: 24 }, (_, index) => (
        <div
          key={index}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            width: index % 5 === 0 ? 2 : 1,
            height: index % 5 === 0 ? 2 : 1,
            left: `${(((index * 1234567 + 89) % 9973) / 9973) * 100}%`,
            top: `${(((index * 7654321 + 31) % 9973) / 9973) * 70}%`,
            opacity: 0.1 + (index % 7) * 0.06,
          }}
        />
      ))}
      <div className="relative flex-1 flex items-end justify-center gap-[2.5%] w-[95%] mx-auto">
        {podium.map((entry) => {
          const rank = top3.indexOf(entry) + 1;
          return (
            <PodiumCard
              key={entry.id}
              entry={entry}
              rank={rank}
              showScore={showScore}
              showPercent={showPercent}
              showSoldValue={showSoldValue}
              accent={accent}
              prize={prizeFor(rank)}
            />
          );
        })}
      </div>
    </div>
  );
}

export { formatBrl };
