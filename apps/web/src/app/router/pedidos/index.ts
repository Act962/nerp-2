import { createKitchenOrder } from "./create";
import { createKitchenOrderMany } from "./create-many";
import { listKitchenOrders } from "./list";
import { moveKitchenOrder } from "./move";
import { moveKitchenTicket } from "./move-ticket";
import { setArchivedKitchenOrder } from "./archive";
import { acceptTicket } from "./accept-ticket";
import { rejectTicket } from "./reject-ticket";
import { listPendingTickets } from "./list-pending-tickets";
import { listPendingPrint } from "./list-pending-print";
import { markTicketPrinted } from "./mark-printed";
import { publicReadyOrders } from "./public-ready";
import { publicCustomerOrder } from "./public-customer";
import { publicTicketOrder } from "./public-ticket";
import { waiterCollaborators } from "./waiter-collaborators";
import { waiterCreate } from "./waiter-create";
import { waiterListForAttendant } from "./waiter-list";
import { waiterProducts } from "./waiter-products";
import { waiterDeliver } from "./waiter-deliver";
import { listKitchenOrderEvents } from "./events-list";
import { listKitchenColumns } from "./columns/list";
import { createKitchenColumn } from "./columns/create";
import { updateKitchenColumn } from "./columns/update";
import { deleteKitchenColumn } from "./columns/delete";
import { reorderKitchenColumns } from "./columns/reorder";
import { waiterJoinLink } from "./waiter-join-link";

export const kitchenRoutes = {
  list: listKitchenOrders,
  create: createKitchenOrder,
  createMany: createKitchenOrderMany,
  move: moveKitchenOrder,
  moveTicket: moveKitchenTicket,
  setArchived: setArchivedKitchenOrder,
  // Fila de aceite do cardápio (fora do board até o dono aceitar).
  listPendingTickets,
  acceptTicket,
  rejectTicket,
  // Estação de impressão.
  listPendingPrint,
  markPrinted: markTicketPrinted,
  waiterJoinLink,
  // App do garçom: exigem sessão + vínculo com a org do slug.
  waiterCollaborators,
  waiterCreate,
  waiterListForAttendant,
  waiterProducts,
  waiterDeliver,
  // Públicas de verdade: a TV não tem login, e o cliente chega pelo QR.
  publicReady: publicReadyOrders,
  publicCustomerOrder,
  publicTicketOrder,
  events: { list: listKitchenOrderEvents },
  columns: {
    list: listKitchenColumns,
    create: createKitchenColumn,
    update: updateKitchenColumn,
    delete: deleteKitchenColumn,
    reorder: reorderKitchenColumns,
  },
};
