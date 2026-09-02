/**
 * A URL pública de uma imagem do bucket.
 *
 * É a mesma regra do `constructUrl` do `apps/web`, copiada e não importada:
 * são quatro linhas, e importar de dentro de outro app é justamente o que o
 * monorepo evita. Sem o host configurado devolve vazio, e quem chama decide o
 * fallback visual — melhor do que gerar `https://undefined/...`.
 */
export function assetUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (key.startsWith("data:")) return key;
  if (key.startsWith("/")) return key;

  const host = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!host) return "";
  return `https://${host}/${key}`;
}
