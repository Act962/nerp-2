"use client";

import { useEffect } from "react";

/**
 * O site escuta pedidos do admin para rolar até um bloco.
 *
 * O admin roda em outra origem (localhost:3001 em dev, admin.orbita em prod) e
 * embute a página num `<iframe>`. Comunicação via `postMessage` é o único
 * caminho que atravessa a fronteira — mudar `location.hash` funcionaria mas
 * força um scroll INSTANTÂNEO e não dá para diferenciar clique-do-admin de
 * visita direta ao anchor.
 *
 * O componente monta-se em CADA página; um efeito só registra o listener uma
 * vez porque o React em StrictMode remonta, e sem `once` acabaríamos com
 * dois handlers respondendo ao mesmo evento.
 */
type Aviso = { type: "site:scrollToBlock"; blockId: string };

function ehAviso(data: unknown): data is Aviso {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "site:scrollToBlock" &&
    typeof (data as { blockId?: unknown }).blockId === "string"
  );
}

export function ScrollToBlockListener() {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!ehAviso(event.data)) return;
      const alvo = document.getElementById(`bloco-${event.data.blockId}`);
      if (!alvo) return;
      alvo.scrollIntoView({ behavior: "auto", block: "start" });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
  return null;
}
