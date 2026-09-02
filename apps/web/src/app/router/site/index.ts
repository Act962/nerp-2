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
};
