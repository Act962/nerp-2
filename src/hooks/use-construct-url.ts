export function constructUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  // Asset que veio junto com a aplicação (`/marcas/...`) — logo semeada não
  // depende do bucket estar de pé nem de ninguém ter feito upload.
  if (key.startsWith("/")) return key;
  return `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
}

export function useConstructUrl(key: string): string {
  return constructUrl(key);
}
