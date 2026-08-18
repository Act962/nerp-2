import type { NextConfig } from "next";

const s3BucketHostname =
  process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL ?? "";

const nextConfig: NextConfig = {
  /* config options here */
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
