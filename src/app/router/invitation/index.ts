import { acceptInvitation } from "./accept";
import { cancelInvitation } from "./cancel";
import { createInvitation } from "./create";
import { getInvitation } from "./get";
import { acceptJoinLink } from "./join-link/accept";
import { deleteJoinLink } from "./join-link/delete";
import { listJoinLinks } from "./join-link/list";
import { previewJoinLink } from "./join-link/preview";
import { regenerateJoinLink } from "./join-link/regenerate";
import { saveJoinLink } from "./join-link/save";
import { listInvitations } from "./list";
import { rejectInvitation } from "./reject";
import { resendInvitation } from "./resend";

export const invitationRoutes = {
  create: createInvitation,
  list: listInvitations,
  get: getInvitation,
  cancel: cancelInvitation,
  resend: resendInvitation,
  accept: acceptInvitation,
  reject: rejectInvitation,
  // Link aberto de entrada (com QR). `preview` é PÚBLICO de propósito — quem
  // abre o link ainda pode não ter conta; não adicionar middleware de auth ali.
  joinLink: {
    list: listJoinLinks,
    save: saveJoinLink,
    regenerate: regenerateJoinLink,
    delete: deleteJoinLink,
    preview: previewJoinLink,
    accept: acceptJoinLink,
  },
};
