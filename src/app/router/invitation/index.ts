import { acceptInvitation } from "./accept";
import { cancelInvitation } from "./cancel";
import { createInvitation } from "./create";
import { getInvitation } from "./get";
import { acceptJoinLink } from "./join-link/accept";
import { getJoinLink } from "./join-link/get";
import { previewJoinLink } from "./join-link/preview";
import { rotateJoinLink } from "./join-link/rotate";
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
    get: getJoinLink,
    rotate: rotateJoinLink,
    preview: previewJoinLink,
    accept: acceptJoinLink,
  },
};
