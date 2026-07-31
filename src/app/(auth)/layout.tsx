import Link from "next/link";

interface authenticateLayoutProps {
  children: React.ReactNode;
}

// Layout compartilhado por login, cadastro, esqueci-senha e redefinir-senha.
//
// Duas versões do logo em vez de uma: o arquivo original tem o nome
// "TradeGram" em preto, que desaparece no tema escuro. A variante `-dark`
// é o mesmo SVG com o texto claro — trocadas por CSS, sem JS.
export default function Layout({ children }: authenticateLayoutProps) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="self-center" aria-label="TradeGram">
          {/* biome-ignore lint/performance/noImgElement: logo estática em public/ */}
          <img
            src="/tradegram-logo.svg"
            alt="TradeGram"
            className="h-10 w-auto dark:hidden"
          />
          {/* biome-ignore lint/performance/noImgElement: logo estática em public/ */}
          <img
            src="/tradegram-logo-dark.svg"
            alt=""
            aria-hidden="true"
            className="hidden h-10 w-auto dark:block"
          />
        </Link>
        {children}
      </div>
    </div>
  );
}
