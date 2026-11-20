import { isSuperAdmin } from "@/lib/super-admin";

// Quem vê o mapeamento do banco enquanto ele é ferramenta interna: o super
// admin e a conta de desenvolvimento. Lista própria, e não `SUPER_ADMIN_EMAILS`,
// para a conta de dev não ganhar junto os outros poderes de super admin
// (Biblioteca Órbita global etc.).
//
// Arquivo puro: o servidor (`server/acesso.ts`) e o botão do painel do Winthor
// leem a mesma regra.
const EQUIPE_DO_MAPEAMENTO: readonly string[] = ["dev@nasaerp.com"];

export function ehDaEquipeDoMapeamento(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return (
    isSuperAdmin(email) || EQUIPE_DO_MAPEAMENTO.includes(email.toLowerCase())
  );
}
