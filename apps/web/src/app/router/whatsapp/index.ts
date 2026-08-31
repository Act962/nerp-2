import { getConnection } from "./get-connection";
import { removeConnection } from "./remove-connection";
import { saveConnection } from "./save-connection";
import { testConnection } from "./test-connection";

/**
 * Conexão do número de WhatsApp com um funil.
 *
 * Enviar e receber mensagem não passa por aqui — isso é o `message` e o
 * webhook. Este router só cuida da credencial: gravar, conferir contra a Meta
 * e desconectar.
 */
export const whatsappRoutes = {
  connection: {
    get: getConnection,
    save: saveConnection,
    test: testConnection,
    remove: removeConnection,
  },
};
