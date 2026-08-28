"use client";

import { ErrorScreen } from "@/components/error-screen";

// Boundary do ERP autenticado: uma exceção numa tela (PDV, produtos, caixa)
// para AQUI. A sidebar e o header continuam de pé e o operador consegue
// navegar para outro lugar, em vez de ficar com a aba branca.
export default function ErpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} />;
}
