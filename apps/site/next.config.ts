import type { NextConfig } from "next";

/**
 * O site institucional é um app à parte do ERP: ele não conhece banco, nem
 * login, nem storage. Tudo que precisa vem do `apps/web` por HTTP, e as
 * imagens vêm do bucket público — servidas por <img>, com key resolvida em
 * `lib/assets`, então não há `images.remotePatterns` para manter aqui.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `@nerp/site-content` é publicado como TypeScript cru (é um pacote interno
  // do monorepo, sem build). Sem esta linha o Next não o compila e o build de
  // produção quebra no primeiro import de valor.
  transpilePackages: ["@nerp/site-content"],
};

export default nextConfig;
