import { buildSyncHeaders } from "@/lib/sync-system-cred";
import type {
  SyncAccountPayload,
  SyncMemberPayload,
  SyncOrgPayload,
  SyncType,
  SyncUserPayload,
} from "@/lib/sync-payloads";

/**
 * Cliente OUTBOUND do sync de auth: NERP → NASA.
 *
 * Assina com a credencial de SISTEMA (`SYNC_SHARED_SECRET` / `SYNC_API_KEY`) e
 * aponta para o endpoint inbound do NASA (`NASA_SYNC_BASE_URL` + `/api/sync/nerp`).
 * Lança em falha não-2xx para o processador da outbox agendar retry/backoff.
 */

const INBOUND_PATH = "/api/sync/nerp";
const TIMEOUT_MS = Number(process.env.SYNC_REQUEST_TIMEOUT_MS ?? 10_000);

function baseUrl(): string {
  const b = process.env.NASA_SYNC_BASE_URL;
  if (!b) {
    throw new Error("Missing env NASA_SYNC_BASE_URL");
  }
  return b.replace(/\/$/, "");
}

async function send(type: SyncType, data: unknown): Promise<void> {
  const body = JSON.stringify({ type, data });
  const headers = buildSyncHeaders({
    method: "POST",
    path: INBOUND_PATH,
    body,
  });

  const res = await fetch(`${baseUrl()}${INBOUND_PATH}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`sync→nasa ${type} failed: HTTP ${res.status} ${text}`);
  }
}

export const syncNasaClient = {
  upsertUser: (data: SyncUserPayload) => send("user", data),
  upsertAccount: (data: SyncAccountPayload) => send("account", data),
  upsertOrg: (data: SyncOrgPayload) => send("org", data),
  upsertMember: (data: SyncMemberPayload) => send("member", data),
};
