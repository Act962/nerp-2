import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { getPublicSiteContent } from "@/features/site/server/public-content";
import type { ContextoToolsApp } from "./_contexto";

/** WhatsApp e e-mail do suporte da ÓRBITA, como o admin do site cadastrou. */
export function construirToolsDeSuporte(_ctx: ContextoToolsApp): ToolSet {
  return {
    contatoDoSuporte: tool({
      description:
        "O contato do suporte da ÓRBITA (WhatsApp e e-mail), para quando a pessoa precisa falar com gente.",
      inputSchema: z.object({}),
      execute: async () => {
        const conteudo = await getPublicSiteContent();
        const numero = conteudo.whatsapp?.number ?? WHATSAPP_PADRAO;
        return {
          whatsapp: numero,
          whatsappHref: `https://wa.me/${numero}`,
          email: conteudo.contact?.email ?? null,
        };
      },
    }),
  };
}

/** O mesmo número do site institucional, para o suporte nunca ficar sem canal. */
const WHATSAPP_PADRAO = "558698221810";
