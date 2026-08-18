-- O valor precisa nascer numa transação ANTERIOR à que o usa: o Postgres não
-- deixa usar um valor de enum na mesma transação em que ele foi adicionado, e o
-- Prisma roda cada migration.sql dentro de uma transação. Juntar as duas coisas
-- quebraria o `pnpm build`, que roda `prisma migrate deploy`.
ALTER TYPE "CompanySource" ADD VALUE 'PROMOTOR';
