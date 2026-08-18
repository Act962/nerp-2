/**
 * Fundo claro fixo para todo o app público do TradeGram.
 *
 * Vale para as páginas filhas também (`/buscar`, `/entrar`, `/<slug>`): fixar
 * só a primeira faria a tela piscar de claro para escuro ao navegar.
 */
export default function TradeGramPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tradegram-light min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
