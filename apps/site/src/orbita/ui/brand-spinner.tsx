"use client";

import { BRAND } from "./brand";
import "./brand-spinner.css";

/**
 * O símbolo da marca girando — o carregador do site.
 *
 * Um componente só, usado em dois lugares: o véu de abertura, enquanto as
 * texturas do planeta chegam, e o overlay entre páginas. Se fossem dois
 * desenhos, uma mudança de tamanho ou de ritmo teria de ser feita duas vezes e
 * um dos dois acabaria diferente do outro.
 *
 * O CSS viaja junto com o componente de propósito: o overlay aparece também
 * nas páginas internas, que não carregam o `orbita.css` da cena.
 *
 * Nada é redesenhado: é o arquivo oficial `orbita-symbol.webp`, o mesmo da
 * cortina azul.
 */
export function BrandSpinner() {
  // Sem `alt`: é decoração de um estado. Quem lê tela recebe o aviso de quem
  // usa o componente, não daqui.
  // biome-ignore lint/performance/noImgElement: asset fixo do site, sem otimização a fazer
  return <img className="o-spin" src={BRAND.symbol} alt="" />;
}
