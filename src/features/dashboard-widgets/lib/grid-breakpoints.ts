// Config compartilhada do grid — mesma engine (react-grid-layout) em todos os
// tamanhos de tela, só reconfigurada: em xxs (mobile) cols=1 força largura
// total e vira lista empilhada; resize só faz sentido a partir de md.
export const GRID_BREAKPOINTS = { lg: 1024, md: 768, sm: 480, xxs: 0 } as const;
export const GRID_COLS = { lg: 12, md: 8, sm: 4, xxs: 1 } as const;
export const GRID_ROW_HEIGHT = 64;

export type GridBreakpoint = keyof typeof GRID_BREAKPOINTS;

/** Altura (em linhas da grade) que o card ocupa recolhido: só o cabeçalho. */
export const COLLAPSED_ROWS = 1;

// Altura de cada widget no empilhamento mobile.
//
// Antes era `h: 2` para todo mundo — 128px fixos. Num card de número isso
// sobra, mas o pódio do ranking precisa de 420-560px e uma tabela de 20 linhas
// precisa de mais ainda: tudo era espremido no mesmo espaço e quebrava. Aqui a
// altura vem do que o widget realmente desenha.
export function mobileRowsFor(options: {
  displayType: string;
  dataSourceKey: string;
  childCount: number;
}): number {
  const base = (() => {
    // O ranking embute o pódio real da tela /ranking (altura própria fixa de
    // 420-560px) mais as linhas de colocação e o carrossel de times ativos.
    if (options.dataSourceKey === "ranking.teamRankingTop") return 12;
    switch (options.displayType) {
      case "STAT":
        return 2;
      case "CHART":
        return 4;
      case "MAP":
        return 5;
      default:
        // LIST e TABLE rolam internamente, mas abaixo disso a rolagem começa
        // antes da primeira linha ficar legível.
        return 5;
    }
  })();

  // Desdobramentos são linhas compactas: no mobile a grade deles é de 1 coluna,
  // então cada par de filhos pede mais ou menos meia linha de grade.
  return base + Math.ceil(options.childCount / 2);
}
export const BREAKPOINTS_WITH_LAYOUT: GridBreakpoint[] = ["lg", "md", "sm"];

export interface GridItemLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}
