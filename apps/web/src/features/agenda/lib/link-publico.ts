/**
 * Endereço público de uma agenda.
 *
 * Mora fora do componente porque o link é montado em três lugares (lista,
 * editor e o texto que o atendente cola no WhatsApp) e um deles com barra a
 * mais é um link quebrado na mão do cliente.
 */
export function linkPublico(orgSlug: string, agendaSlug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_DOMAIN ?? "");
  return `${base.replace(/\/$/, "")}/publico/agenda/${orgSlug}/${agendaSlug}`;
}
