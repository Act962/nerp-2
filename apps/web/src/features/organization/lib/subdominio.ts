/**
 * Regras do subdomínio da vitrine.
 *
 * Módulo neutro (sem `server-only`): o formulário valida enquanto a pessoa
 * digita e o servidor valida de novo antes de gravar — a mesma função nos dois
 * lugares é o que impede a tela aceitar o que o servidor recusa.
 *
 * A lista de reservados existe porque `middleware.ts` só ignora `www` e
 * `admin` na hora de reescrever a URL; qualquer outro nome vira vitrine de
 * quem chegar primeiro — inclusive `api`, `login` ou `nerp`.
 */

export const SUBDOMINIOS_RESERVADOS = new Set([
  "www",
  "admin",
  "api",
  "app",
  "site",
  "login",
  "cadastro",
  "mail",
  "smtp",
  "static",
  "assets",
  "cdn",
  "nerp",
  "orbita",
  "astro",
  "nasa",
  "suporte",
  "status",
  "dev",
  "staging",
  "preview",
]);

export const SUBDOMINIO_TAMANHO_MIN = 3;
export const SUBDOMINIO_TAMANHO_MAX = 63;

/** Só minúsculas, dígitos e hífen no meio — o que um rótulo DNS aceita. */
const FORMATO = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

export type ResultadoDoSubdominio =
  | { ok: true; subdominio: string }
  | { ok: false; motivo: string };

export function validarSubdominio(valor: string): ResultadoDoSubdominio {
  const subdominio = valor.trim().toLowerCase();

  if (
    subdominio.length < SUBDOMINIO_TAMANHO_MIN ||
    subdominio.length > SUBDOMINIO_TAMANHO_MAX
  ) {
    return {
      ok: false,
      motivo: `O subdomínio precisa ter entre ${SUBDOMINIO_TAMANHO_MIN} e ${SUBDOMINIO_TAMANHO_MAX} caracteres.`,
    };
  }
  if (!FORMATO.test(subdominio)) {
    return {
      ok: false,
      motivo:
        "Use só letras minúsculas, números e hífen, sem começar ou terminar com hífen.",
    };
  }
  if (SUBDOMINIOS_RESERVADOS.has(subdominio)) {
    return { ok: false, motivo: "Este subdomínio é reservado." };
  }
  return { ok: true, subdominio };
}
