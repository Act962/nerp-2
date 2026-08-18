import { createNerpClient } from "@nerp/api";
import type { DesktopApi } from "./api-contract";
import { API_URL } from "./config";
import { getStoredSession } from "./token-store";

// Cliente oRPC tipado do backend (contrato `DesktopApi`). O bearer é lido do
// token-store a cada request.
export const client = createNerpClient<DesktopApi>({
  baseUrl: API_URL,
  getToken: () => getStoredSession()?.token ?? null,
});
