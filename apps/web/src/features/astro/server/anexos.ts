/**
 * O que pode chegar anexado numa mensagem para o Astro.
 *
 * A regra que importa é a do endereço: um anexo só vale se apontar para o
 * prefixo da PRÓPRIA organização no bucket. Sem isso, uma mensagem forjada
 * pediria ao modelo para "ler" a foto de outra empresa — ou qualquer URL da
 * internet, transformando o servidor num buscador de conteúdo alheio.
 *
 * Módulo neutro, sem `server-only`: a tela usa a mesma allowlist para não
 * deixar a pessoa escolher um arquivo que o servidor vai recusar.
 */

export const TIPOS_DE_ANEXO_ACEITOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Quantos arquivos cabem numa mensagem. Mais que isso é conta de API. */
export const MAX_ANEXOS_POR_MENSAGEM = 4;

export type ParteDeArquivo = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
};

export type VereditoDeAnexo = { ok: true } | { ok: false; motivo: string };

export function tipoDeAnexoAceito(mediaType: string): boolean {
  return (TIPOS_DE_ANEXO_ACEITOS as readonly string[]).includes(
    mediaType.toLowerCase(),
  );
}

/**
 * O endereço público do bucket para esta organização. Só o que começa assim
 * é anexo desta empresa.
 */
export function prefixoPublicoDaOrg(
  organizationId: string,
  host = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL,
): string | null {
  if (!host) return null;
  return `https://${host}/${organizationId}/`;
}

export function conferirAnexos(
  partes: readonly ParteDeArquivo[],
  organizationId: string,
  host = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL,
): VereditoDeAnexo {
  if (partes.length === 0) return { ok: true };
  if (partes.length > MAX_ANEXOS_POR_MENSAGEM) {
    return {
      ok: false,
      motivo: `No máximo ${MAX_ANEXOS_POR_MENSAGEM} imagens por mensagem.`,
    };
  }

  const prefixo = prefixoPublicoDaOrg(organizationId, host);
  if (!prefixo) {
    return {
      ok: false,
      motivo: "O armazenamento de imagens não está configurado neste ambiente.",
    };
  }

  for (const parte of partes) {
    if (!tipoDeAnexoAceito(parte.mediaType)) {
      return {
        ok: false,
        motivo: `Só aceito imagem JPEG, PNG ou WebP — veio "${parte.mediaType}".`,
      };
    }
    if (!parte.url.startsWith(prefixo)) {
      return {
        ok: false,
        motivo: "Este anexo não pertence à sua organização.",
      };
    }
  }

  return { ok: true };
}

/** As partes de arquivo de uma lista de mensagens, sem confiar na forma. */
export function anexosDasMensagens(mensagens: unknown[]): ParteDeArquivo[] {
  const anexos: ParteDeArquivo[] = [];
  for (const mensagem of mensagens) {
    const partes = (mensagem as { parts?: unknown }).parts;
    if (!Array.isArray(partes)) continue;
    for (const parte of partes) {
      if (typeof parte !== "object" || parte === null) continue;
      const candidata = parte as Partial<ParteDeArquivo>;
      if (candidata.type !== "file") continue;
      anexos.push({
        type: "file",
        mediaType: String(candidata.mediaType ?? ""),
        url: String(candidata.url ?? ""),
        filename:
          typeof candidata.filename === "string"
            ? candidata.filename
            : undefined,
      });
    }
  }
  return anexos;
}

/**
 * A chave no bucket de um endereço que já é da organização.
 *
 * Serve para não baixar de novo o que já está lá dentro: anexo da conversa e
 * imagem gerada pelo Astro nascem no prefixo da organização, e `null` aqui
 * significa "isto é de fora, trate como endereço externo".
 */
export function chaveDoAnexo(
  url: string,
  organizationId: string,
  host = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL,
): string | null {
  const prefixo = prefixoPublicoDaOrg(organizationId, host);
  if (!prefixo || !url.startsWith(prefixo)) return null;
  const chave = url.slice(`https://${host}/`.length);
  return chave.length > 0 ? chave : null;
}
