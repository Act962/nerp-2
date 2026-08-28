/**
 * Guarda de leitura do bucket público de imagens.
 *
 * `/api/s3/image` não tem autenticação — é assim de propósito, porque serve
 * imagem de vitrine e catálogo público. O preço é que qualquer key conhecida é
 * baixável por qualquer um, então nada sensível pode viver naquele bucket.
 *
 * Certificados A1 chegaram a ser gravados lá (a rota de upload aceitava
 * `application/x-pkcs12`). O upload foi movido para o bucket fiscal privado,
 * mas os objetos antigos continuam no bucket de imagens — esta guarda é o que
 * impede que sigam sendo servidos, e o que impede a regressão voltar.
 */

/** Extensões de material criptográfico que nunca devem sair por rota pública. */
const BLOCKED_EXTENSIONS = [
  ".pfx",
  ".p12",
  ".pem",
  ".key",
  ".jks",
  ".crt",
  ".cer",
  ".der",
];

/** Prefixo dos objetos fiscais — espelha `FISCAL_KEY_PREFIX`. */
const BLOCKED_PREFIX = "fiscal/";

/**
 * A key é sensível demais para uma rota sem sessão?
 *
 * Normaliza antes de decidir: uma key com `%2e%2e/` ou barra à esquerda passaria
 * numa comparação ingênua de prefixo.
 */
export function isSensitiveObjectKey(key: string): boolean {
  let normalized = key.trim().toLowerCase();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Key com escape inválido não é confiável — trata como sensível.
    return true;
  }
  normalized = normalized.replace(/\\/g, "/").replace(/^\/+/, "");

  if (normalized.includes("..")) return true;
  if (normalized.startsWith(BLOCKED_PREFIX)) return true;
  if (normalized.includes(`/${BLOCKED_PREFIX}`)) return true;

  // Compara sem query string: `?x=1` no fim não deve escapar da checagem.
  const withoutQuery = normalized.split(/[?#]/)[0];
  return BLOCKED_EXTENSIONS.some((ext) => withoutQuery.endsWith(ext));
}
