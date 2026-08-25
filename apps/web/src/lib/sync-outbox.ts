import prisma from "./db";
import { inngest, syncNasaRequested } from "./inngest/client";
import type { SyncType } from "./sync-payloads";

/**
 * Emite um evento de sync (NERP → NASA), fire-and-forget.
 *
 * Chamado pelos hooks do better-auth no NERP. Grava uma linha de auditoria na
 * `SyncOutbox` (best-effort) e dispara o evento Inngest `sync/nasa.requested`,
 * que entrega ao NASA com retry/backoff nativos. NUNCA lança — só loga — pra
 * não quebrar o sign-up/criação local se o banco ou o Inngest falharem.
 */
export async function enqueueSyncOutbox(
  type: SyncType,
  payload: unknown,
): Promise<void> {
  let outboxId: string | undefined;

  // 1. Trilha de auditoria (não bloqueante).
  try {
    const row = await prisma.syncOutbox.create({
      data: { type, payload: payload as object },
    });
    outboxId = row.id;
  } catch (e) {
    console.error(`[sync emit nerp] audit ${type} failed:`, e);
  }

  // 2. Entrega event-driven via Inngest.
  try {
    await inngest.send(syncNasaRequested.create({ type, payload, outboxId }));
  } catch (e) {
    console.error(`[sync emit nerp] inngest send ${type} failed:`, e);
  }
}
