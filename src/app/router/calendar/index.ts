import { getChecklistProgress } from "./checklist-progress";
import { createCalendarEvent } from "./create";
import { deleteCalendarEvent } from "./delete";
import { getCalendarFilterOptions } from "./filter-options";
import { getCalendarEvent } from "./get";
import { listCalendar } from "./list";
import { moveCalendarEvent } from "./move";
import {
  createCalendarNote,
  deleteCalendarNote,
  updateCalendarNote,
} from "./notes";
import { setCalendarChecklist } from "./set-checklist";
import { toggleChecklistItem } from "./toggle-checklist-item";
import { updateCalendarEvent } from "./update";

export const calendarRoutes = {
  list: listCalendar,
  get: getCalendarEvent,
  filterOptions: getCalendarFilterOptions,
  create: createCalendarEvent,
  update: updateCalendarEvent,
  delete: deleteCalendarEvent,
  move: moveCalendarEvent,
  setChecklist: setCalendarChecklist,
  toggleChecklistItem,
  checklistProgress: getChecklistProgress,
  createNote: createCalendarNote,
  updateNote: updateCalendarNote,
  deleteNote: deleteCalendarNote,
};
