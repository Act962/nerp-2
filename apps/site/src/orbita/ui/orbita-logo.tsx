import { BRAND } from "./brand";

/**
 * O logotipo, como arquivo.
 *
 * É o PNG oficial da ÓRBITA convertido para WebP — nenhuma versão redesenhada
 * em SVG. Como ele já vem branco, serve sobre o azul da abertura e sobre o
 * espaço sem troca de asset.
 */
export function OrbitaLogo({ className }: { className?: string }) {
  return (
    // O logotipo é um asset fixo de poucos KB, e esta pasta é portátil: trocar
    // por `next/image` amarraria a experiência ao framework sem ganho real.
    // biome-ignore lint/performance/noImgElement: asset estático e portátil
    <img
      className={className}
      src={BRAND.lockup}
      alt="ÓRBITA"
      width={987}
      height={220}
      draggable={false}
    />
  );
}
