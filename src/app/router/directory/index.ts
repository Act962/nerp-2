import { claimDirectoryCompany } from "./claim";
import { createDirectoryCompany } from "./create";
import { listMyCompanies } from "./my-companies";
import { searchDirectory } from "./search";

export const directoryRoutes = {
  search: searchDirectory,
  create: createDirectoryCompany,
  claim: claimDirectoryCompany,
  myCompanies: listMyCompanies,
};
