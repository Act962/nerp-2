// Marca do app no rodapé das páginas públicas (logo oficial em public/).
export function TradeGramFooter() {
  return (
    <footer className="flex items-center justify-center py-8">
      {/* biome-ignore lint/performance/noImgElement: logo estática em public/ */}
      <img src="/tradegram-logo.svg" alt="Tradegram" className="h-9 w-auto" />
    </footer>
  );
}
