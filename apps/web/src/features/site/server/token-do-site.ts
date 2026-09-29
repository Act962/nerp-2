import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * O segredo que só o servidor do `apps/site` conhece.
 *
 * As rotas que GRAVAM (o chat do Astro, a coleta de métricas) não têm CORS: o
 * navegador fala com o próprio site, e o site repassa com este cabeçalho.
 */
export function tokenDoSiteConfere(recebido: string | null): boolean {
  const esperado = process.env.SITE_ASTRO_TOKEN;
  // Sem segredo configurado a rota fica aberta em dev — em produção, defina.
  if (!esperado) return true;
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
