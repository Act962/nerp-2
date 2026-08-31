"use client";

import Image from "next/image";
import { useState } from "react";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import type { ProviderManifest } from "../catalog/types";

/**
 * Logo do provedor com monograma de reserva.
 *
 * O fallback não é detalhe: sem ele o catálogo ficaria bloqueado esperando a
 * arte de trinta bancos. Logo que falta vira quadrado com a inicial na cor da
 * marca, e o card continua legível.
 */
export function ProviderLogo({
  manifest,
  logoKey,
  className,
}: {
  manifest: ProviderManifest;
  /** Logo enviada pelo super-admin; vence o asset da aplicação. */
  logoKey?: string | null;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const src = logoKey ? constructUrl(logoKey) : manifest.logo;
  const mostraImagem = Boolean(src) && !falhou;

  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background",
        className,
      )}
      style={mostraImagem ? undefined : { backgroundColor: manifest.cor }}
    >
      {mostraImagem ? (
        <Image
          src={src ?? ""}
          alt=""
          width={44}
          height={44}
          // SVG de marca não ganha nada com o otimizador, e `unoptimized` mantém
          // o onError disparando quando o arquivo ainda não foi adicionado.
          unoptimized
          className="size-full object-contain p-1.5"
          onError={() => setFalhou(true)}
        />
      ) : (
        <span className="font-semibold text-sm text-white mix-blend-luminosity">
          {monograma(manifest.nome)}
        </span>
      )}
    </div>
  );
}

function monograma(nome: string): string {
  const palavras = nome
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 2);
  if (palavras.length === 0) return nome.slice(0, 2).toUpperCase();
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return `${palavras[0][0]}${palavras[1][0]}`.toUpperCase();
}
