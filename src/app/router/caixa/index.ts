import { abrirCaixa } from "./abrir";
import { getCurrentCaixa } from "./current";
import { fecharCaixa } from "./fechar";
import { listCaixaSessions } from "./list";
import { listCaixaMovements } from "./movements";
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
};
