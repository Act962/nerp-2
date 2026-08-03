"use client";

import { MapPin } from "lucide-react";
import { useMarketSize } from "../hooks/use-tradegram";

/**
 * O tamanho do mercado, com números reais.
 *
 * Substitui a prova social inventada ("mais de 8.500 clientes") que estava no
 * herói público. Um número verdadeiro e pequeno convence mais que um grande e
 * falso — e este cresce a cada visita de promotor.
 */
export function MarketSizeRibbon({
  state,
  city,
  variant = "inline",
}: {
  state?: string | null;
  city?: string | null;
  variant?: "inline" | "hero";
}) {
  const { data } = useMarketSize(state, city);
  if (!data || data.total === 0) return null;

  const local = data.inCity ?? data.inState;
  const localLabel = data.inCity?.city ?? data.inState?.state ?? null;

  if (variant === "hero") {
    return (
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <MapPin className="size-4" />
        <strong className="text-foreground">
          {data.total.toLocaleString("pt-BR")}
        </strong>
        pontos de venda mapeados no Brasil
        {data.topStates.length > 0 && (
          <span className="text-xs">
            ·{" "}
            {data.topStates
              .slice(0, 3)
              .map((row) => `${row.state} ${row.pdvs.toLocaleString("pt-BR")}`)
              .join(" · ")}
          </span>
        )}
      </p>
    );
  }

  // No cadastro: fala da praça da pessoa, que é o que a convence.
  return (
    <p className="text-xs text-muted-foreground">
      {local && localLabel && local.pdvs > 0 ? (
        <>
          Já mapeamos{" "}
          <strong className="text-foreground">
            {local.pdvs.toLocaleString("pt-BR")}
          </strong>{" "}
          ponto(s) de venda em {localLabel}.
        </>
      ) : (
        <>
          {data.total.toLocaleString("pt-BR")} pontos de venda mapeados no
          Brasil.
        </>
      )}
    </p>
  );
}
