"use client";

import {
  type AstroChatDoSite,
  carregadorDoAstroChat,
} from "@nerp/site-content";
import { useEffect } from "react";

/**
 * O ASTRO do Órbita, no lugar do consultor do site.
 *
 * Quando o admin cola o código do ASTRO CHAT, quem atende o visitante é o
 * widget que o Órbita entrega a qualquer cliente. Este componente faz o que a
 * instrução de instalação de lá pede — pôr o `<script>` na página — e mais
 * nada: o widget se desenha sozinho, em Shadow DOM, e fala direto com o
 * Órbita.
 *
 * O script é criado à mão, e não com uma tag no JSX, por três motivos:
 *
 * - **uma vez só.** O cabeçalho do site é remontado a cada troca de página, e
 *   este componente vai junto. O `id` impede a segunda inserção, e o próprio
 *   carregador também se recusa a rodar duas vezes.
 * - **fica onde está.** O script nunca é removido: tirar a tag não desmonta o
 *   widget, só apagaria a pista de que ele já foi carregado.
 * - **`data-key` de verdade.** É por esse atributo que o carregador descobre
 *   de qual site cadastrado ele é — e, com isso, para qual organização e para
 *   qual tracking a conversa vai.
 */

const ID_DO_SCRIPT = "astro-chat-do-orbita";

export function AstroChatDoOrbita({ chat }: { chat: AstroChatDoSite }) {
  const { chave } = chat;
  const endereco = carregadorDoAstroChat(chat);

  useEffect(() => {
    if (document.getElementById(ID_DO_SCRIPT)) return;
    const script = document.createElement("script");
    script.id = ID_DO_SCRIPT;
    script.src = endereco;
    script.async = true;
    script.dataset.key = chave;
    document.body.appendChild(script);
  }, [chave, endereco]);

  return null;
}
