import { syncNasaClient } from "@/http/sync-nasa/client";
import type {
  SyncAccountPayload,
  SyncMemberPayload,
  SyncOrgPayload,
  SyncUserPayload,
} from "@/lib/sync-payloads";

/**
 * Roteia um evento de sync para o método correto do cliente outbound (NERP →
 * NASA). Lança em falha não-2xx — quem chama (a função Inngest) trata como
 * falha de step e reagenda com backoff.
 */
export async function deliver(type: string, payload: unknown): Promise<void> {
  switch (type) {
    case "user":
      return syncNasaClient.upsertUser(payload as SyncUserPayload);
    case "account":
      return syncNasaClient.upsertAccount(payload as SyncAccountPayload);
    case "org":
      return syncNasaClient.upsertOrg(payload as SyncOrgPayload);
    case "member":
      return syncNasaClient.upsertMember(payload as SyncMemberPayload);
    default:
      throw new Error(`unknown sync type: ${type}`);
  }
}
