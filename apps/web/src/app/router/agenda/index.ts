import { cancelAppointment } from "./cancel-appointment";
import { createAgenda } from "./create";
import { createAppointment } from "./create-appointment";
import { getAgenda } from "./get";
import { listAgendas } from "./list";
import { listAppointments } from "./list-appointments";
import { bookPublicAgenda } from "./public/book";
import { cancelPublicAppointment } from "./public/cancel-appointment";
import { getPublicAgenda } from "./public/get";
import { getPublicAppointment } from "./public/get-appointment";
import { listPublicSlots } from "./public/list-slots";
import { setAvailability } from "./set-availability";
import { setDateOverride } from "./set-date-override";
import { updateAgenda } from "./update";

/**
 * Agenda — disponibilidade, link público de marcação e compromissos.
 *
 * `publica.*` é o único bloco sem autenticação: resolve a organização pelo
 * slug da URL, como o catálogo e o checkout já fazem. Todo o resto é escopado
 * por `context.org.id`.
 */
export const agendaRoutes = {
  list: listAgendas,
  get: getAgenda,
  create: createAgenda,
  update: updateAgenda,
  setAvailability,
  setDateOverride,
  appointment: {
    list: listAppointments,
    create: createAppointment,
    cancel: cancelAppointment,
  },
  publica: {
    get: getPublicAgenda,
    slots: listPublicSlots,
    book: bookPublicAgenda,
    appointment: getPublicAppointment,
    cancel: cancelPublicAppointment,
  },
};
