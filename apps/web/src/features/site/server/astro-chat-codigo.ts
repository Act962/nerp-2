import { CHAVE_DO_ASTRO_CHAT } from "@nerp/site-content";

/**
 * O código de instalação do ASTRO CHAT, lido.
 *
 * No Órbita, quem cadastra um site recebe uma linha de `<script>` para colar
 * no próprio site. O admin cola essa linha em `/site/melhorias`, do jeito que
 * o Órbita entrega, e a partir daí quem atende em orbitatec.com.br é o ASTRO
 * de lá, no lugar do consultor deste repositório.
 *
 * A linha não é gravada para ser despejada no HTML: dela sai só a chave. O
 * endereço do script é montado do lado de cá, com o servidor do Órbita que
 * vem do ambiente — um campo de texto do admin não decide de onde o site dos
 * visitantes baixa JavaScript.
 *
 * Função pura, sem banco e sem rede: é o que permite testar o formato.
 */

/** A chave no meio de um texto maior — a linha inteira do `<script>`. */
const CHAVE_NO_MEIO = /ac_pk_[A-Za-z0-9_-]{8,40}/;

export const ASTRO_CHAT_KEY = "astro-chat";

/** O teto do que se guarda: a linha do Órbita tem perto de 130 caracteres. */
export const LIMITE_DO_CODIGO = 600;

export type CodigoLido =
  | { ok: true; chave: string; servidor: string | null }
  | { ok: false; motivo: "vazio" | "sem_chave" | "outro_servidor" };

/** O `src` do script, quando o código é a linha inteira. */
function servidorDoCodigo(codigo: string): string | null {
  const src = codigo.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!src) return null;
  try {
    return new URL(src).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Tira a chave do que foi colado.
 *
 * Aceita a linha inteira ou só a chave — quem copia do Órbita às vezes
 * seleciona só o `data-key`.
 *
 * `servidorEsperado` é o endereço do Órbita que este app conhece. Se o código
 * colado aponta para OUTRO servidor, ele é recusado: a chave não valeria lá,
 * e quem colou um script de outro lugar precisa saber disso na hora.
 */
export function lerCodigoDoAstroChat(
  codigo: string,
  servidorEsperado: string,
): CodigoLido {
  const limpo = codigo.trim();
  if (!limpo) return { ok: false, motivo: "vazio" };

  if (CHAVE_DO_ASTRO_CHAT.test(limpo)) {
    return { ok: true, chave: limpo, servidor: null };
  }

  const chave = limpo.match(CHAVE_NO_MEIO)?.[0];
  if (!chave) return { ok: false, motivo: "sem_chave" };

  const servidor = servidorDoCodigo(limpo);
  if (servidor && servidor !== servidorEsperado.toLowerCase()) {
    return { ok: false, motivo: "outro_servidor" };
  }
  return { ok: true, chave, servidor };
}

/** O que fica guardado em `site_settings`. */
export type AstroChatGuardado = { codigo: string; chave: string };

/** O que veio do banco não é premissa: fora do formato, é como se não houvesse. */
export function lerAstroChatGuardado(valor: unknown): AstroChatGuardado | null {
  if (typeof valor !== "object" || valor === null) return null;
  const { codigo, chave } = valor as { codigo?: unknown; chave?: unknown };
  if (typeof chave !== "string" || !CHAVE_DO_ASTRO_CHAT.test(chave)) {
    return null;
  }
  return { codigo: typeof codigo === "string" ? codigo : chave, chave };
}
