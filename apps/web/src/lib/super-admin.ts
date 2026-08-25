// Super-admin do sistema: quem pode gerir a Biblioteca Órbita global (foto
// modelo). Enforce sempre no servidor (routers globais); no cliente serve só
// pra mostrar/esconder controles. Lista pra facilitar adicionar outros depois.
export const SUPER_ADMIN_EMAILS = ["weydsonlima@gmail.com"] as const;

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return (SUPER_ADMIN_EMAILS as readonly string[]).includes(
    email.toLowerCase(),
  );
}
