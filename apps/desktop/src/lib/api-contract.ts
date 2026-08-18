/**
 * Contrato tipado das chamadas que o desktop usa.
 *
 * Por quê não inferir o `AppRouter` inteiro: importar o tipo do router do FONTE
 * faria o tsc do desktop compilar toda a árvore do servidor (Prisma, `@/…`,
 * server-only). Enquanto o router não é extraído para um package que emite
 * `.d.ts` (Fase 5), consumidores cross-project declaram só a fatia que usam.
 * Drift em relação à API real é coberto por testes de integração no `apps/web`.
 *
 * As formas abaixo espelham `router/device/pair-with-credentials.ts` e
 * `router/products/list.ts`.
 */
export type DesktopApi = {
  device: {
    pairWithCredentials: (input: {
      email: string;
      password: string;
      name: string;
      platform: "windows" | "macos" | "linux";
      organizationId?: string;
    }) => Promise<{
      deviceId: string;
      token: string;
      organizationId: string;
      organizationName: string;
    }>;
  };
  products: {
    list: (input: {
      limit: number;
      search?: string;
      cursor?: string;
    }) => Promise<{
      products: Array<{
        id: string;
        name: string;
        sku: string;
        salePrice: number;
        currentStock: number;
        unit: string;
      }>;
      totalCount: number;
      nextCursor: string | null;
      hasNextPage: boolean;
    }>;
  };
};
