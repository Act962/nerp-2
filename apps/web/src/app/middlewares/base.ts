import { os } from "@orpc/server";
import type { Organization, User } from "@/generated/prisma/client";

export type BaseContext = {
  headers: Headers;
  isS2S?: true;
  s2sOrg?: Organization;
  s2sUser?: User;
  s2sScopes?: string[];
  // Principal de dispositivo desktop (bearer). Espelha o S2S; ver
  // `device-auth-verify.ts` e o ramo device nos middlewares de auth/org.
  isDevice?: true;
  deviceOrg?: Organization;
  deviceUser?: User;
  deviceScopes?: string[];
};

export const base = os.$context<BaseContext>().errors({
  BAD_REQUEST: {
    message: "You are being ratee limited",
  },
  NOT_FOUND: {
    message: "Not found",
  },
  FORBIDDEN: {
    message: "This is forbidden",
  },
  UNAUTHORIZED: {
    message: "You are not authorized",
  },
  INTERNAL_SERVER_ERROR: {
    message: "Something went wrong",
  },
});
