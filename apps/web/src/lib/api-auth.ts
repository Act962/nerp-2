import { auth } from "./auth";

// Guard de sessão para route handlers REST (/api/*). Diferente do `requireAuth`
// de auth-utils.ts, que faz redirect("/login") — num route handler o cliente
// espera status, não redirecionamento.
export async function getApiSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
