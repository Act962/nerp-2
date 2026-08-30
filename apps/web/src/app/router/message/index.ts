import { listMessages } from "./list";
import { sendMessage } from "./send";

export const messageRoutes = {
  list: listMessages,
  send: sendMessage,
};
