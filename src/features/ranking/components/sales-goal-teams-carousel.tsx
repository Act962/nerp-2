"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

// Iniciais do avatar do time: 1ª letra das 2 primeiras palavras — desambigua
// equipes com prefixo igual ("PI - SUL"→PS, "PI - NORTE"→PN). Nome de 1 palavra
// cai nos 2 primeiros caracteres ("CAPITAL"→CA, "Todas"→TO).
function teamInitials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 2)
    .toUpperCase();
}

export function SalesGoalTeamsCarousel({
  teams,
  selectedId,
  onSelect,
  autoAdvanceSeconds,
  accent,
  defaultPlaying = false,
}: {
  teams: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  autoAdvanceSeconds: number;
  accent: string;
  /**
   * Já começa girando. Default `false` mantém o board como sempre foi (quem
   * está operando a tela não quer o time trocando sozinho); o widget do
   * dashboard liga, porque ali a rotação é o objetivo.
   */
  defaultPlaying?: boolean;
}) {
  const [playing, setPlaying] = useState(defaultPlaying);
  const [remaining, setRemaining] = useState(autoAdvanceSeconds);

  useEffect(() => {
    setRemaining(autoAdvanceSeconds);
  }, [autoAdvanceSeconds]);

  useEffect(() => {
    if (!playing || teams.length === 0) return;
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          const currentIndex = teams.findIndex(
            (team) => team.id === selectedId,
          );
          const nextIndex = (currentIndex + 1) % teams.length;
          onSelect(teams[nextIndex].id);
          return autoAdvanceSeconds;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playing, teams, selectedId, autoAdvanceSeconds, onSelect]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-white/5">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-[11px] text-muted-foreground shrink-0">
          Times Ativos:
        </span>
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            onClick={() => onSelect(team.id)}
            title={team.name}
            className="size-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 transition-all"
            style={
              team.id === selectedId
                ? {
                    borderColor: accent,
                    background: `${accent}33`,
                    color: accent,
                  }
                : {
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.5)",
                  }
            }
          >
            {teamInitials(team.name)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {String(minutes).padStart(2, "0")}m:{String(seconds).padStart(2, "0")}
          s | Restantes...
        </span>
        <button
          type="button"
          onClick={() => setPlaying((current) => !current)}
          className="size-8 rounded-full flex items-center justify-center"
          style={{ background: accent }}
        >
          {playing ? (
            <Pause className="size-3.5 text-white" />
          ) : (
            <Play className="size-3.5 text-white ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
