import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from "./accounts";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./categories";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "./contacts";
import {
  createCostCenter,
  deleteCostCenter,
  listCostCenters,
  updateCostCenter,
} from "./cost-centers";
import { getCashflow, getDashboard } from "./dashboard";
import {
  cancelEntry,
  createEntry,
  deleteEntry,
  listEntries,
  payEntry,
  updateEntry,
} from "./entries";

export const financeiroRoutes = {
  accounts: {
    list: listAccounts,
    create: createAccount,
    update: updateAccount,
    delete: deleteAccount,
  },
  categories: {
    list: listCategories,
    create: createCategory,
    update: updateCategory,
    delete: deleteCategory,
  },
  costCenters: {
    list: listCostCenters,
    create: createCostCenter,
    update: updateCostCenter,
    delete: deleteCostCenter,
  },
  contacts: {
    list: listContacts,
    create: createContact,
    update: updateContact,
    delete: deleteContact,
  },
  entries: {
    list: listEntries,
    create: createEntry,
    update: updateEntry,
    pay: payEntry,
    cancel: cancelEntry,
    delete: deleteEntry,
  },
  dashboard: {
    get: getDashboard,
    cashflow: getCashflow,
  },
};
