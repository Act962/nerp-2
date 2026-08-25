// Super usuário que pode criar/excluir "Estilos do sistema" (globais, visíveis
// para todas as organizações). Os demais usuários só criam "Meus estilos".
export const SUPER_USER_EMAIL = "weydsonlima@gmail.com";

export function isSuperUser(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === SUPER_USER_EMAIL;
}
