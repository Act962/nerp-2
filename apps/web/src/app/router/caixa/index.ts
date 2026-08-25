import { abrirCaixa } from "./abrir";
import { closeCaixaFromDevice } from "./close-from-device";
import { getCurrentCaixa } from "./current";
import { fecharCaixa } from "./fechar";
import { listCaixaSessions } from "./list";
import { listCaixaMovements } from "./movements";
import { cashMovementFromDevice } from "./movement-from-device";
import { openCaixaFromDevice } from "./open-from-device";
import { sangriaCaixa } from "./sangria";
import { suprimentoCaixa } from "./suprimento";

export const caixaRoutes = {
  abrir: abrirCaixa,
  fechar: fecharCaixa,
  sangria: sangriaCaixa,
  suprimento: suprimentoCaixa,
  current: getCurrentCaixa,
  list: listCaixaSessions,
  movements: listCaixaMovements,
  // Replay offline do device (idempotentes por operationId).
  openFromDevice: openCaixaFromDevice,
  movementFromDevice: cashMovementFromDevice,
  closeFromDevice: closeCaixaFromDevice,
};
