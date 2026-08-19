/**
 * Contrato tipado das chamadas oRPC que o desktop usa.
 *
 * Por quê hand-authored e não `RouterClient<AppRouter>` inferido: o tipo do
 * `router` (55 entidades) é grande demais para o TS SERIALIZAR num `.d.ts`
 * (TS7056), então um consumidor cross-project não consegue inferi-lo a partir de
 * um pacote — declara só a fatia que usa.
 *
 * O risco (drift em relação à API real) é neutralizado por um GUARD de
 * conformidade em `apps/web` (`src/app/router/_desktop-conformance.ts`): ele
 * afirma, em tempo de compilação, que o client real do router satisfaz este
 * contrato. Se uma procedure mudar de forma sem atualizar aqui, o `check-types`
 * do WEB quebra — o mesmo padrão de "paridade que quebra o CI" dos enums do
 * `@nerp/types`. Fica no `@nerp/api` (não no desktop) justamente para o web
 * poder importá-lo e checar a conformidade.
 *
 * As formas espelham `router/device/pair-with-credentials.ts`,
 * `router/products/{list,pull}.ts` e `router/sales/create-from-device.ts`.
 */
export type DesktopPaymentMethod =
  | "DINHEIRO"
  | "PIX"
  | "DEBITO"
  | "CREDITO"
  | "BOLETO"
  | "TRANSFERENCIA"
  | "OUTROS";

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
    // Sync incremental do catálogo (server → device). Espelha router/products/pull.ts.
    pull: (input: {
      updatedAt: string | null;
      id: string | null;
      limit: number;
    }) => Promise<{
      products: Array<{
        id: string;
        name: string;
        sku: string;
        barcode: string;
        salePrice: number;
        currentStock: number;
        unit: string;
        isActive: boolean;
        updatedAt: string;
      }>;
      cursor: { updatedAt: string; id: string } | null;
      hasMore: boolean;
    }>;
  };
  sales: {
    // Replay idempotente de venda offline. Espelha router/sales/create-from-device.ts.
    createFromDevice: (input: {
      operationId: string;
      clientSessionId: string;
      customerId?: string;
      discount: number;
      total: number;
      status: "COMPLETED";
      soldAt?: string;
      payments: Array<{ method: DesktopPaymentMethod; amount: number }>;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
      }>;
    }) => Promise<{ saleId: string; saleNumber: number; duplicate: boolean }>;
  };
  caixa: {
    // Sessão de caixa offline (replay idempotente). Espelha router/caixa/*-from-device.
    openFromDevice: (input: {
      operationId: string;
      openingBalance: number;
      registerName: string;
      openedAt?: string;
      openingNotes?: string;
    }) => Promise<{ sessionId: string; openedAt: string; duplicate: boolean }>;
    movementFromDevice: (input: {
      operationId: string;
      clientSessionId: string;
      kind: "SANGRIA" | "SUPRIMENTO";
      amount: number;
      description?: string;
    }) => Promise<{ id: string; duplicate: boolean }>;
    closeFromDevice: (input: {
      operationId: string;
      clientSessionId: string;
      countedBalance: number;
      closedAt?: string;
      closingNotes?: string;
    }) => Promise<{
      expectedBalance: number;
      countedBalance: number;
      difference: number;
      duplicate: boolean;
    }>;
  };
};
