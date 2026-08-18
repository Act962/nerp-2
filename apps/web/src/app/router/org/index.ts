import { checkSubdomain } from "./check-subdomain";
import { getOrganization } from "./get";
import { updateOrgProfile } from "./update-profile";
import { updateOrgDisabledModules } from "./update-disabled-modules";
import { updateOrgLogo } from "./update-logo";
import { updateOrgPublicProfile } from "./update-public-profile";
import { updateOrgSigla } from "./update-sigla";
import { updateSubdomain } from "./update-subdomain";
import { updateRequireCancelAuth } from "./update-require-cancel-auth";

export const orgRoutes = {
  get: getOrganization,
  updateProfile: updateOrgProfile,
  checkSubdomain: checkSubdomain,
  updateSubdomain: updateSubdomain,
  updateSigla: updateOrgSigla,
  updateDisabledModules: updateOrgDisabledModules,
  updatePublicProfile: updateOrgPublicProfile,
  updateLogo: updateOrgLogo,
  updateRequireCancelAuth,
};
