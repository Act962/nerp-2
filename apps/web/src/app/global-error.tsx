"use client";

import { ErrorScreen } from "@/components/error-screen";

// Último recurso: pega o que escapa até do layout raiz — o caso em que hoje
// aparece "Application error: a client-side exception has occurred". Substitui
// o documento inteiro, então precisa trazer <html> e <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
