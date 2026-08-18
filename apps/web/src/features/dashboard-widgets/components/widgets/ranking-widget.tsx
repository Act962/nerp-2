"use client";

import { RankingPage } from "@/features/ranking/components/ranking-page";

// Widget de Ranking = a página /ranking inteira, embutida no dashboard.
// Antes era uma reprodução compacta (pódio + top 5 + carrossel) que divergia
// do board real; agora reusa o próprio `RankingPage`, então toolbar, seletor
// de período, side rail, lista full e diálogos de edição vêm de graça — e
// qualquer ajuste na tela /ranking reflete aqui sozinho.
//
// O wrapper aplica `overflow-y-auto` porque o board tem altura própria (pódio
// fixo, side rail etc.) e o card do widget tem tamanho limitado pelo grid do
// dashboard — sem isso o conteúdo vazava.
export function RankingWidget() {
  return (
    <div className="h-full overflow-y-auto -m-3">
      <RankingPage />
    </div>
  );
}
