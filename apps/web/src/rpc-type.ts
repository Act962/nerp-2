/**
 * Entrypoint TYPE-ONLY do router para consumidores externos (desktop, scripts).
 *
 * É só tipo: o `import type` é apagado na compilação, então importar `AppRouter`
 * NÃO arrasta Prisma nem código de servidor para o bundle do cliente. Exposto
 * como subpath `@nerp/web/rpc-type` no package.json.
 */
import type { router } from "./app/router";

export type AppRouter = typeof router;
