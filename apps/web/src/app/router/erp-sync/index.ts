import { getErpConnection } from "./get-connection";
import { removeErpConnection } from "./remove-connection";
import { runErpSyncNow } from "./run";
import { saveErpConnection } from "./save-connection";
import { setErpConnectionPaused } from "./set-paused";
import { setErpStockBranch } from "./set-stock-branch";
import { getErpSyncStatus } from "./status";
import { testErpConnection } from "./test-connection";

export const erpSyncRoutes = {
  status: getErpSyncStatus,
  run: runErpSyncNow,
  getConnection: getErpConnection,
  saveConnection: saveErpConnection,
  testConnection: testErpConnection,
  setPaused: setErpConnectionPaused,
  setStockBranch: setErpStockBranch,
  removeConnection: removeErpConnection,
};
