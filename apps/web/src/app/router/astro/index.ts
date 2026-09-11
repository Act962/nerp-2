import { esquecerMemoria, listarMemorias } from "./listar-memorias";
import { listarAvisos } from "./listar-avisos";
import { marcarFalado, marcarLido, marcarTodosLidos } from "./marcar";

/**
 * O Astro visto de fora da conversa: os avisos que ele tem para dar e o que
 * ele lembra da organização.
 *
 * A conversa em si não passa por aqui — ela é um route handler
 * (`/api/astro/chat`), porque a resposta é um stream.
 */
export const astroRoutes = {
  avisos: {
    listar: listarAvisos,
    marcarLido,
    marcarFalado,
    marcarTodosLidos,
  },
  memorias: {
    listar: listarMemorias,
    esquecer: esquecerMemoria,
  },
};
