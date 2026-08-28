export function constructUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  // Logo gravada em base64 pelo formulário de criação de organização: já é uma
  // src renderizável, prefixar o bucket transformaria numa URL inválida.
  if (key.startsWith("data:")) return key;
  // Asset que veio junto com a aplicação (`/marcas/...`) — logo semeada não
  // depende do bucket estar de pé nem de ninguém ter feito upload.
  if (key.startsWith("/")) return key;
  // Sem o bucket público configurado, cair fora em vez de gerar
  // `https://undefined/<key>` — URL inválida faz o <Image> do Next bater e
  // aparecer quebrada intermitentemente (o env às vezes está ausente em builds
  // locais apontados pra dados de produção). Vazio deixa o chamador decidir o
  // fallback visual.
  const host = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!host) return "";
  return `https://${host}/${key}`;
}

export function useConstructUrl(key: string): string {
  return constructUrl(key);
}
