/**
 * De onde vêm os arquivos da cena.
 *
 * Por padrão, de `public/orbita` — o caminho normal dentro do Next. Mas a
 * mesma cena precisa rodar em lugares que não servem `public/`: a página de
 * preview publicada é um HTML único, sem pasta ao lado.
 *
 * `globalThis.__ORBITA_TEXTURES__` resolve isso sem condicional espalhada pelo
 * código: um mapa de caminho público → URL (ou data URI). Quem não define o
 * mapa não muda de comportamento; quem define troca arquivo por arquivo.
 */
export function asset(path: string) {
  const overrides = (
    globalThis as { __ORBITA_TEXTURES__?: Record<string, string> }
  ).__ORBITA_TEXTURES__;
  return overrides?.[path] ?? path;
}
