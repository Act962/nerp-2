import { closeLead } from "./close-lead";
import { createFunnel } from "./create-funnel";
import { createReason } from "./motivos/create";
import { listReasons } from "./motivos/list";
import { archiveTag } from "./tags/archive";
import { createTag } from "./tags/create";
import { listTags } from "./tags/list";
import { setTagsOnLead } from "./tags/set-on-lead";
import { getLead } from "./get-lead";
import { listFunnels } from "./list-funnels";
import { listLeads } from "./list-leads";
import { moveLead } from "./move-lead";
import { listStages } from "./list-stages";
import { updateLead } from "./update-lead";

/**
 * CRM — funil, etapas e a ficha do lead.
 *
 * O board arrasta com ordenação fracionária: mover um card grava uma posição
 * entre os vizinhos em vez de renumerar a coluna. Presets de funil continuam
 * pendentes.
 */
export const crmRoutes = {
  funnel: {
    create: createFunnel,
    list: listFunnels,
  },
  stage: {
    list: listStages,
  },
  lead: {
    list: listLeads,
    get: getLead,
    update: updateLead,
    move: moveLead,
    close: closeLead,
    setTags: setTagsOnLead,
  },
  tag: {
    list: listTags,
    create: createTag,
    archive: archiveTag,
  },
  motivo: {
    list: listReasons,
    create: createReason,
  },
};
