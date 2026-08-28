import { claimScannerPairing } from "./claim";
import { createScannerPairing } from "./create-pairing";
import { pushScannerScan } from "./push-scan";
import { revokeScannerPairing } from "./revoke";
import { scannerStatus } from "./status";

export const scannerRoutes = {
  createPairing: createScannerPairing,
  claim: claimScannerPairing,
  push: pushScannerScan,
  status: scannerStatus,
  revoke: revokeScannerPairing,
};
