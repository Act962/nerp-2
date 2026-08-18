// Origem do backend. Configurável por ambiente: em dev aponta para o web local;
// no build de produção do desktop, para a URL do Coolify.
export const API_URL =
  import.meta.env.VITE_NERP_API_URL ?? "http://localhost:3000";
