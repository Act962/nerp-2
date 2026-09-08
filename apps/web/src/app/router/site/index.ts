import {
  deleteMenuItem,
  listMenu,
  reorderMenu,
  saveMenuItem,
  toggleMenuItem,
} from "./menu";
import {
  createPage,
  deletePage,
  getPage,
  listPages,
  publishPage,
  savePage,
  unpublishPage,
} from "./pages";
import { listMedia, registerMedia, removeMedia } from "./media";
import { inviteAccess, listAccess, removeAccess } from "./access";
import { getSettings, saveSettings } from "./settings";
import { siteOverview } from "./overview";
import { deleteLead, getLead, listLeads, updateLead } from "./leads";
import {
  getPricing,
  saveAstroConfig,
  savePricing,
  simularPreco,
} from "./pricing";
import {
  deleteBrand,
  deletePartner,
  listBrands,
  listPartners,
  reorderBrands,
  reorderPartners,
  saveBrand,
  savePartner,
  toggleBrand,
  togglePartner,
} from "./partners";

export const siteRoutes = {
  overview: siteOverview,
  menu: {
    list: listMenu,
    save: saveMenuItem,
    reorder: reorderMenu,
    toggle: toggleMenuItem,
    delete: deleteMenuItem,
  },
  pages: {
    list: listPages,
    get: getPage,
    create: createPage,
    save: savePage,
    publish: publishPage,
    unpublish: unpublishPage,
    delete: deletePage,
  },
  media: {
    list: listMedia,
    register: registerMedia,
    remove: removeMedia,
  },
  access: {
    list: listAccess,
    invite: inviteAccess,
    remove: removeAccess,
  },
  settings: {
    get: getSettings,
    save: saveSettings,
  },
  partners: {
    list: listPartners,
    save: savePartner,
    reorder: reorderPartners,
    toggle: togglePartner,
    delete: deletePartner,
  },
  brands: {
    list: listBrands,
    save: saveBrand,
    reorder: reorderBrands,
    toggle: toggleBrand,
    delete: deleteBrand,
  },
  // O consultor de IA: a tabela de faixas e os leads que ele qualifica.
  astro: {
    getPricing,
    savePricing,
    saveConfig: saveAstroConfig,
    simular: simularPreco,
  },
  leads: {
    list: listLeads,
    get: getLead,
    update: updateLead,
    delete: deleteLead,
  },
};
