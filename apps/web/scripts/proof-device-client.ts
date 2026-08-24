/**
 * Prova manual da Fase 0 (ver specs/desktop-fase-0.md §5).
 *
 * Simula o desktop: monta o cliente tipado com `@nerp/api` + o tipo `AppRouter`
 * (type-only, não arrasta código de servidor) e chama um procedure real usando
 * um token de device como bearer. Valida CORS + ramo bearer + factory +
 * inferência de tipos de uma vez.
 *
 * A procedure tem de estar na allowlist de `src/lib/device-scopes.ts` — um
 * bearer de device NÃO alcança o router inteiro. Por isso `products.pull`, que
 * é o que o desktop realmente chama, e não uma listagem comum do ERP.
 *
 * Uso (contra staging ou local):
 *   NERP_API_URL=https://staging... NERP_DEVICE_TOKEN=<token> pnpm --filter @nerp/web exec tsx scripts/proof-device-client.ts
 *
 * O token sai de `device.pair` (chamado logado no ambiente-alvo) ou do
 * `scripts/seed-desktop-proof.ts`.
 */
import { createNerpClient } from "@nerp/api";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "@/rpc-type";

async function main() {
  const baseUrl = process.env.NERP_API_URL;
  const token = process.env.NERP_DEVICE_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      "Defina NERP_API_URL e NERP_DEVICE_TOKEN no ambiente antes de rodar.",
    );
  }

  const client = createNerpClient<RouterClient<AppRouter>>({
    baseUrl,
    getToken: () => token,
  });

  const result = await client.products.pull({
    updatedAt: null,
    id: null,
    limit: 5,
  });
  console.info(`OK — ${result.products.length} produtos na org do device:`);
  for (const product of result.products) {
    console.info(` - ${product.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
