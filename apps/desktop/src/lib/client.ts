import { createNerpClient, type DesktopApi } from "@nerp/api";
import { API_URL } from "./config";
import { getCurrentToken } from "./token-store";

// Cliente oRPC tipado do backend (contrato `DesktopApi`). O bearer vem do cache
// em memória do token-store (síncrono — sem I/O por request).
export const client = createNerpClient<DesktopApi>({
  baseUrl: API_URL,
  getToken: () => getCurrentToken(),
});
