import { os } from "@orpc/server";
import type { Organization, User } from "@/generated/prisma/client";

export type BaseContext = {
  headers: Headers;
  isS2S?: true;
  s2sOrg?: Organization;
  s2sUser?: User;
  s2sScopes?: string[];
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
