import { pairDevice } from "./pair";
import { listDevices } from "./list";
import { revokeDevice } from "./revoke";

export const deviceRoutes = {
  pair: pairDevice,
  list: listDevices,
  revoke: revokeDevice,
};
