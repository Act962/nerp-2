import react from "@vitejs/plugin-react";
import type { ViteUserConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Presets de project do Vitest compartilhados pelo monorepo.
 *
 * Tudo num arquivo só de propósito: o Vitest externaliza este pacote e o
 * carrega pelo Node, que exige extensão explícita em import relativo. Sem
 * imports internos, não há essa armadilha.
 *
 * O pacote exporta TypeScript CRU, e o Node só consegue lê-lo com type
 * stripping — ligado por padrão apenas a partir do 22.18. Em Node mais antigo o
 * carregador de config do Vite externaliza este arquivo e o `import` estoura com
 * `SyntaxError`, derrubando a suíte inteira antes do primeiro teste. É por isso
 * que os scripts de teste passam `--configLoader runner`: o module runner do
 * Vitest transpila em vez de externalizar. Não tire a flag sem antes exigir
 * Node >= 22.18.
 */

/**
 * `tsconfigPaths` é o que faz `@/...` resolver dentro do Vitest — o alias vive
 * só no tsconfig do app, e o Vite não o lê sozinho.
 *
 * O alias de `server-only` existe porque esse pacote lança ao ser importado
 * fora do bundler do Next; 51 arquivos de `apps/web/src` o importam, e sem o
 * stub qualquer teste que toque a árvore de server morre no import.
 */
const base = {
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        find: /^server-only$/,
        replacement: "@nerp/vitest-config/server-only-stub",
      },
    ],
  },
} satisfies ViteUserConfig;

type ProjectOptions = {
  name: string;
  include: string[];
  setupFiles?: string[];
  globalSetup?: string[];
};

type NodeProjectOptions = ProjectOptions & {
  /** Testes de integração falam com Postgres — sequencial evita disputa de dados. */
  singleFork?: boolean;
};

/** Project para testes que rodam em Node puro: utilitários, server, procedures. */
export function nodeProject({
  name,
  include,
  setupFiles,
  globalSetup,
  singleFork = false,
}: NodeProjectOptions): ViteUserConfig {
  return {
    ...base,
    test: {
      name,
      include,
      setupFiles,
      globalSetup,
      environment: "node",
      ...(singleFork
        ? {
            pool: "forks" as const,
            poolOptions: { forks: { singleFork: true } },
          }
        : {}),
    },
  };
}

/**
 * Project para testes de componente.
 *
 * Vale só para componentes `"use client"`: React Testing Library não renderiza
 * Server Component assíncrono. Na prática cobre `src/features/*` + `components/`,
 * que é onde está a UI interativa.
 */
export function jsdomProject({
  name,
  include,
  setupFiles,
}: ProjectOptions): ViteUserConfig {
  return {
    ...base,
    plugins: [...base.plugins, react()],
    test: {
      name,
      include,
      setupFiles,
      environment: "jsdom",
      globals: true,
    },
  };
}
