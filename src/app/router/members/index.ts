import { listMembers } from "./list";
import { updateMemberPermissions } from "./update-permissions";
import { updateMemberSupervisor } from "./update-supervisor";
import { getCurrentMember } from "./get-current";
import { updateMemberRole } from "./update-role";
import { updateMyModules } from "./update-my-modules";
import { removeMember } from "./remove";
import { updateMemberTradeRole } from "./update-trade-role";
import { updateMemberPromotorVisibility } from "./update-promotor-visibility";
import { setMemberSupplierLinks } from "./set-supplier-links";
import { setMemberCancelPin } from "./set-cancel-pin";

export const memberRoutes = {
  list: listMembers,
  updatePermissions: updateMemberPermissions,
  updateSupervisor: updateMemberSupervisor,
  updateMyModules: updateMyModules,
  getCurrent: getCurrentMember,
  updateRole: updateMemberRole,
  remove: removeMember,
  updateTradeRole: updateMemberTradeRole,
  updatePromotorVisibility: updateMemberPromotorVisibility,
  setSupplierLinks: setMemberSupplierLinks,
  setCancelPin: setMemberCancelPin,
};
