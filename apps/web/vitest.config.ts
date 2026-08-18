import { jsdomProject, nodeProject } from "@nerp/vitest-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      nodeProject({
        name: "unit",
        include: ["src/**/*.test.ts"],
      }),
      jsdomProject({
        name: "component",
        include: ["src/**/*.test.tsx"],
        setupFiles: ["./tests/setup-component.ts"],
      }),
      nodeProject({
        name: "integration",
        include: ["tests/integration/**/*.test.ts"],
        setupFiles: ["./tests/integration/setup.ts"],
        globalSetup: ["./tests/integration/global-setup.ts"],
        // Fala com Postgres de verdade: serializa para os testes não brigarem
        // pelos mesmos dados.
        singleFork: true,
      }),
    ],
  },
});
