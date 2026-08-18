/**
 * Prova manual da Fase 0 (ver specs/desktop-fase-0.md §5).
 *
 * Simula o desktop: monta o cliente tipado com `@nerp/api` + o tipo `AppRouter`
 * (type-only, não arrasta código de servidor) e chama um procedure real usando
 * um token de device como bearer. Valida CORS + ramo bearer + factory +
 * inferência de tipos de uma vez.
 *
 * Uso (contra staging ou local):
 *   NERP_API_URL=https://staging... NERP_DEVICE_TOKEN=<token> pnpm --filter @nerp/web exec tsx scripts/proof-device-client.ts
 *
 * O token sai de `device.pair` (chamado logado no ambiente-alvo).
 */
import { createNerpClient } from "@nerp/api";
import type { AppRouter } from "@/rpc-type";

async function main() {
  const baseUrl = process.env.NERP_API_URL;
  const token = process.env.NERP_DEVICE_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      "Defina NERP_API_URL e NERP_DEVICE_TOKEN no ambiente antes de rodar.",
    );
  }

  const client = createNerpClient<AppRouter>({
    baseUrl,
    getToken: () => token,
  });

  const result = await client.supplier.list({ page: 1, pageSize: 5 });
  console.info(`OK — ${result.totalCount} fornecedores na org do device:`);
  for (const supplier of result.suppliers) {
    console.info(` - ${supplier.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
