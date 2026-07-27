import { checkSubdomain } from "./check-subdomain";
import { getOrganization } from "./get";
import { updateOrgDisabledModules } from "./update-disabled-modules";
import { updateOrgPublicProfile } from "./update-public-profile";
import { updateOrgSigla } from "./update-sigla";
import { updateSubdomain } from "./update-subdomain";

export const orgRoutes = {
  get: getOrganization,
  checkSubdomain: checkSubdomain,
  updateSubdomain: updateSubdomain,
  updateSigla: updateOrgSigla,
  updateDisabledModules: updateOrgDisabledModules,
  updatePublicProfile: updateOrgPublicProfile,
};
