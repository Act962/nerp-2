import { createKitchenOrder } from "./create";
import { createKitchenOrderMany } from "./create-many";
import { listKitchenOrders } from "./list";
import { moveKitchenOrder } from "./move";
import { setArchivedKitchenOrder } from "./archive";
import { publicReadyOrders } from "./public-ready";
import { publicCollaborators } from "./public-collaborators";
import { publicCreate } from "./public-create";
import { publicListForAttendant } from "./public-list";
import { publicProducts } from "./public-products";
import { publicCustomerOrder } from "./public-customer";
import { publicDeliver } from "./public-deliver";
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
  setArchived: setArchivedKitchenOrder,
  waiterJoinLink,
  publicReady: publicReadyOrders,
  publicCollaborators,
  publicCreate,
  publicListForAttendant,
  publicProducts,
  publicCustomerOrder,
  publicDeliver,
  events: { list: listKitchenOrderEvents },
  columns: {
    list: listKitchenColumns,
    create: createKitchenColumn,
    update: updateKitchenColumn,
    delete: deleteKitchenColumn,
    reorder: reorderKitchenColumns,
  },
};
