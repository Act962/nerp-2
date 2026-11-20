import { z } from "zod";

/**
 * O ASTRO CHAT do Órbita no site.
 *
 * O site pode ser atendido por dois Astros, e nunca pelos dois ao mesmo tempo:
 * o consultor que vem neste repositório, ou o ASTRO CHAT — o widget que o
 * Órbita entrega a qualquer cliente para pôr no próprio site. Quando o admin
 * cola o código de instalação em `/site/melhorias`, é o do Órbita que fica.
 *
 * Este é o pedaço do contrato que atravessa de um app para o outro: o
 * endereço do Órbita e a chave pública do site cadastrado lá. A chave é
 * pública por natureza — sai no HTML de toda página —, mas os dois campos
 * viram um `<script src>` no navegador do visitante, então passam pelo
 * formato dos dois lados, como os IDs de pixel.
 */

/** O formato de `isPublicKeyShape`, do Órbita. */
export const CHAVE_DO_ASTRO_CHAT = /^ac_pk_[A-Za-z0-9_-]{8,40}$/;

/** Só a origem, em https: nada de caminho, consulta ou credencial no meio. */
function ehOrigemSegura(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && url.origin === valor;
  } catch {
    return false;
  }
}

export const astroChatSchema = z.object({
  servidor: z.string().max(200).refine(ehOrigemSegura),
  chave: z.string().regex(CHAVE_DO_ASTRO_CHAT),
});

export type AstroChatDoSite = z.infer<typeof astroChatSchema>;

/** Fora do formato vira ausente: é melhor sem widget que com script alheio. */
export function lerAstroChat(valor: unknown): AstroChatDoSite | null {
  const lido = astroChatSchema.safeParse(valor);
  return lido.success ? lido.data : null;
}

/** De onde o navegador baixa o widget. */
export function carregadorDoAstroChat(chat: AstroChatDoSite): string {
  return `${chat.servidor}/api/astro-chat/loader.js`;
}
