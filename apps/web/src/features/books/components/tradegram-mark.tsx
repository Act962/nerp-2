// Marca "Desenvolvido por [TradeGram]" — sobreposta no canto inferior direito
// da prévia de cada página do book (capa, fotos, extras, final). É a mesma logo
// carimbada nas fotos do app promotor. Espelha o rodapé do PDF (book-document).
export function TradegramMark() {
  return (
    <div className="pointer-events-none absolute bottom-1 right-2 z-10 flex items-center gap-1">
      <span className="text-[8px] leading-none text-neutral-400">
        Desenvolvido por
      </span>
      {/* biome-ignore lint/performance/noImgElement: SVG estático em public/ */}
      <img
        src="/tradegram-logo-dark.svg"
        alt="TradeGram"
        className="h-3 w-auto opacity-80"
      />
    </div>
  );
}
