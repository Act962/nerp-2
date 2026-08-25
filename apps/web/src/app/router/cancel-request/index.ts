import { authorizeCancelByPin } from "./authorize-pin";
import { authorizeCancelByToken } from "./authorize-token";
import { createCancelRequest } from "./create";
import { getCancelRequest } from "./get";
import { getCancelRequestByToken } from "./get-by-token";
import { rejectCancelRequest } from "./reject";

export const cancelRequestRoutes = {
  create: createCancelRequest,
  authorizePin: authorizeCancelByPin,
  authorizeToken: authorizeCancelByToken,
  get: getCancelRequest,
  getByToken: getCancelRequestByToken,
  reject: rejectCancelRequest,
};
