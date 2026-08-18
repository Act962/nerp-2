import { loadTestEnv } from "./env";

// Precisa rodar ANTES de qualquer import de `@/lib/db` — o Prisma Client lê
// `DATABASE_URL` no momento em que o módulo é avaliado.
loadTestEnv();
