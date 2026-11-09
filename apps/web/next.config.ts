import type { NextConfig } from "next";

const s3BucketHostname =
  process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL ?? "";

const nextConfig: NextConfig = {
  /* config options here */
  // `@nerp/site-content` (contrato do site institucional) é TypeScript cru,
  // sem build próprio — o Next precisa compilá-lo junto.
  transpilePackages: ["@nerp/site-content", "@nerp/astro-widget"],
  // pdfjs-dist é carregado só no servidor (parse do texto de encartes PDF na
  // aba Lista). Mantido fora do bundle p/ evitar o resolver do worker e o peso.
  serverExternalPackages: ["pdfjs-dist"],
  // Memória do `next build` no servidor do Coolify. O deploy morria com
  // SIGKILL do kernel ("cannot allocate memory") — não é mais o teto do V8 de
  // `scripts/next-build.mjs`, é a RAM da máquina acabando.
  //
  // O multiplicador são os workers: a coleta de dados e a geração estática
  // sobem `cpus - 1` processos, cada um carregando o client do Prisma (~23 MB
  // de código) e herdando o `--max-old-space-size=8192` do wrapper. Num
  // servidor com muitos núcleos e pouca RAM, a soma passa da máquina. Limitar
  // os workers deixa o build um pouco mais lento e muito mais previsível.
  // `NEXT_BUILD_CPUS` permite subir de novo onde houver RAM sobrando.
  experimental: {
    cpus: Number(process.env.NEXT_BUILD_CPUS) || 2,
    webpackMemoryOptimizations: true,
  },
  // A checagem de tipos dentro do `next build` foi o passo seguinte a morrer
  // por SIGKILL no Coolify, mesmo com os workers limitados: é um `tsc` do
  // projeto inteiro, num worker próprio, com o client do Prisma de 23 MB.
  // Os tipos já são checados no CI (`check-types`, job "typecheck + test"),
  // então o build de deploy não repete o trabalho. Para checar localmente:
  // `pnpm check-types`.
  typescript: {
    ignoreBuildErrors: true,
  },
  // O konva puxa um build Node (`index-node.js`) que faz `require('canvas')`
  // (canvas nativo, só usado em render server-side, que não fazemos — o editor
  // é `ssr: false`). Sem o pacote instalado, o build de produção falha ao
  // resolver 'canvas'; apontamos para `false` para o webpack ignorá-lo.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        hostname: "erp-limas-app.t3.storage.dev",
        port: "",
        protocol: "https",
      },
      {
        hostname: s3BucketHostname,
        port: "",
        protocol: "https",
      },
      {
        hostname: "placehold.co",
        port: "",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
