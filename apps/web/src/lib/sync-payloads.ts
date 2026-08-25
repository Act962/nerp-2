/**
 * Formatos canônicos dos eventos de sync NASA ↔ NERP (espelho do NASA).
 * O `id` (cuid) é a chave de idempotência. Datas viajam como ISO string.
 */

export type SyncType = "user" | "account" | "org" | "member";

export type SyncUserPayload = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SyncAccountPayload = {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scope: string | null;
  password: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SyncOrgPayload = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: string | null;
  createdAt: string;
};

export type SyncMemberPayload = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: string;
};

export type SyncEnvelope =
  | { type: "user"; data: SyncUserPayload }
  | { type: "account"; data: SyncAccountPayload }
  | { type: "org"; data: SyncOrgPayload }
  | { type: "member"; data: SyncMemberPayload };
