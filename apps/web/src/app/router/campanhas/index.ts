import { addRecipientsFromLeads } from "./add-recipients";
import { createCampanha } from "./create";
import { getCampanha } from "./get";
import { listCampanhas } from "./list";
import { listTemplates } from "./list-templates";
import { sendCampanha } from "./send";
import { setTemplate } from "./set-template";

/**
 * Campanhas — disparo em massa pela API oficial.
 *
 * Fora da janela de 24 horas só entra template aprovado, então toda campanha
 * passa por um: não existe disparo de texto livre aqui.
 */
export const campanhasRoutes = {
  create: createCampanha,
  list: listCampanhas,
  get: getCampanha,
  addRecipientsFromLeads,
  listTemplates,
  setTemplate,
  send: sendCampanha,
};
