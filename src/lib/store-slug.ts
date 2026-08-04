import "server-only";
import prisma from "@/lib/db";

/** Slug fica curto para caber num link compartilhado sem virar parágrafo. */
const MAX_LENGTH = 60;
/** Teto de tentativas de sufixo. Bound explícito — laço nunca fica solto. */
const MAX_ATTEMPTS = 50;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Candidatos de slug para uma loja, do mais bonito ao mais sofrido: nome,
 * nome-cidade, e daí sufixos numéricos.
 */
export function storeSlugCandidates(
  name: string,
  city?: string | null,
): string[] {
  const base = slugify(name);
  if (!base) return [];

  const candidates = [base];
  const withCity = city ? `${base}-${slugify(city)}` : null;
  if (withCity && withCity !== base) candidates.push(withCity);
  for (let n = 2; n <= MAX_ATTEMPTS; n += 1) {
    candidates.push(`${withCity ?? base}-${n}`);
  }
  return candidates;
}

/**
 * `/tradegram/<slug>` é o MESMO segmento de `/tradegram/<slug-da-organizacao>`.
 * Por isso a checagem passa pelos dois namespaces: se um slug de loja colidisse
 * com o de uma organização, a URL resolveria a entidade errada — e o
 * despachante dá preferência à organização, então quem perderia é a loja.
 */
export async function findTakenSlugs(
  candidates: string[],
): Promise<Set<string>> {
  const taken = new Set<string>();
  if (candidates.length === 0) return taken;

  const [stores, orgs] = await Promise.all([
    prisma.store.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    }),
    prisma.organization.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    }),
  ]);
  for (const store of stores) if (store.slug) taken.add(store.slug);
  for (const org of orgs) taken.add(org.slug);
  return taken;
}

async function isTaken(candidate: string): Promise<boolean> {
  const taken = await findTakenSlugs([candidate]);
  return taken.size > 0;
}

/**
 * Grava o slug de uma loja recém-criada. Best-effort de propósito.
 *
 * Nunca lança: a URL bonita é conveniência, e derrubar o cadastro de um cliente
 * porque o slug não saiu seria trocar um problema pequeno por um grande. Loja
 * sem slug continua acessível pela URL antiga — quem monta o caminho usa
 * `slug ?? /tradegram/<org>/<id>`.
 */
export async function mintStoreSlug(
  storeId: string,
  name: string,
  city?: string | null,
): Promise<string | null> {
  const candidates = storeSlugCandidates(name, city);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    if (await isTaken(candidate)) continue;
    try {
      await prisma.store.update({
        where: { id: storeId },
        data: { slug: candidate },
      });
      return candidate;
    } catch {
      // P2002: alguém cravou o mesmo slug entre a checagem e o update. A
      // checagem acima é otimização; quem arbitra é o índice único. Tentar o
      // próximo candidato é a resposta certa — não um 500.
    }
  }

  return null;
}

/** Caminho público da loja, com degradação para a URL antiga. */
export function storePublicPath(
  orgSlug: string,
  storeId: string,
  slug: string | null,
): string {
  return slug ? `/tradegram/${slug}` : `/tradegram/${orgSlug}/${storeId}`;
}
