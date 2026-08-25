import { pairDevice } from "./pair";
import { pairDeviceWithCredentials } from "./pair-with-credentials";
import { listDevices } from "./list";
import { revokeDevice } from "./revoke";

export const deviceRoutes = {
  pair: pairDevice,
  pairWithCredentials: pairDeviceWithCredentials,
  list: listDevices,
  revoke: revokeDevice,
};
