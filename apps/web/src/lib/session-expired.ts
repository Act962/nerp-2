/**
 * Aviso de sessão vencida.
 *
 * Até aqui um 401 do oRPC não era tratado em lugar nenhum: toda chamada passava
 * a falhar em silêncio, a tela continuava viva mostrando o cache do TanStack
 * Query, e no PDV o operador seguia bipando sem nada entrar na venda. Era o
 * "travou, ficou parado" que só se resolvia deslogando.
 *
 * NÃO redireciona sozinho: arrancar o operador da tela no meio de uma venda
 * perderia o carrinho. Ele decide quando ir para o login — o que não pode
 * faltar é o aviso.
 */
const REAVISO_MS = 30_000;

let ultimoAviso = 0;

export function notifySessionExpired(): void {
  if (typeof window === "undefined") return;

  // O PDV faz várias chamadas por segundo (grade, caixa, preços). Sem a
  // janela, uma sessão vencida viraria uma enxurrada de toasts.
  const agora = Date.now();
  if (agora - ultimoAviso < REAVISO_MS) return;
  ultimoAviso = agora;

  // Import dinâmico: `orpc.ts` também é alcançado pelo bundle do servidor, e
  // o sonner é só de cliente.
  void import("sonner").then(({ toast }) => {
    toast.error("Sua sessão expirou. Entre de novo para continuar.", {
      id: "sessao-expirada",
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: "Entrar",
        onClick: () => {
          window.location.href = "/login";
        },
      },
    });
  });
}
