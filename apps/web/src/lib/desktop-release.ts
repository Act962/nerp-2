import "server-only";

import { z } from "zod";

/**
 * Manifesto do release do app desktop (NERP Caixa).
 *
 * O instalador e um `latest.json` moram no bucket público (R2), fora do deploy:
 * publicar uma versão nova é rodar `scripts/publish-desktop-release.ts`, sem
 * build do web, sem migration e sem reiniciar nada. O servidor lê o manifesto
 * (com cache curto) e a página de Aplicativos renderiza o que veio.
 */

export const DESKTOP_RELEASE_MANIFEST_KEY = "releases/desktop/latest.json";

export const desktopDownloadSchema = z.object({
  /** Rótulo mostrado no botão, ex.: "Windows 10/11 (64 bits)". */
  label: z.string().min(1),
  os: z.enum(["windows", "macos", "linux"]),
  /** Empacotamento: nsis (.exe), msi, dmg, appimage… */
  format: z.string().min(1),
  url: z.string().url(),
  /** Bytes — a página mostra o tamanho antes de o cliente clicar. */
  size: z.number().int().nonnegative(),
  /** Hex do SHA-256, para quem quiser conferir o arquivo baixado. */
  sha256: z.string().optional(),
});

export const desktopReleaseSchema = z.object({
  version: z.string().min(1),
  publishedAt: z.string().min(1),
  notes: z.string().optional(),
  downloads: z.array(desktopDownloadSchema).min(1),
});

export type DesktopDownload = z.infer<typeof desktopDownloadSchema>;
export type DesktopRelease = z.infer<typeof desktopReleaseSchema>;

export type DesktopReleaseResult =
  | { status: "ok"; release: DesktopRelease }
  /** Ambiente sem bucket/manifesto configurado — nada foi publicado ainda. */
  | { status: "unconfigured" }
  /** Manifesto configurado mas inalcançável ou inválido. */
  | { status: "unavailable"; reason: string };

/** URL do manifesto. Explícita por env, ou derivada do bucket público. */
export function desktopReleaseManifestUrl(): string | null {
  const explicit = process.env.DESKTOP_RELEASE_MANIFEST_URL?.trim();
  if (explicit) return explicit;
  const host = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL?.trim();
  if (!host) return null;
  return `https://${host}/${DESKTOP_RELEASE_MANIFEST_KEY}`;
}

/**
 * Lê o manifesto. Nunca lança: o bucket estar fora do ar não pode derrubar a
 * página — ela mostra o motivo e um botão de tentar de novo.
 */
export async function getLatestDesktopRelease(): Promise<DesktopReleaseResult> {
  const url = desktopReleaseManifestUrl();
  if (!url) return { status: "unconfigured" };

  let response: Response;
  try {
    // 5 min: publicar uma versão aparece rápido sem transformar cada abertura
    // da página numa ida ao bucket.
    response = await fetch(url, { next: { revalidate: 300 } });
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : "Falha de rede",
    };
  }

  // 404 é o estado normal antes da primeira publicação, não um erro de infra.
  if (response.status === 404) return { status: "unconfigured" };
  if (!response.ok) {
    return { status: "unavailable", reason: `HTTP ${response.status}` };
  }

  const parsed = desktopReleaseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) {
    return { status: "unavailable", reason: "Manifesto em formato inválido" };
  }
  return { status: "ok", release: parsed.data };
}
