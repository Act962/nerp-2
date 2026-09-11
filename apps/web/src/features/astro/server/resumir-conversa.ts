import "server-only";

import { generateText, type UIMessage } from "ai";
import type { ModeloResolvido } from "@/features/astro-consultor/server/provider";
import prisma from "@/lib/db";
import { MAX_MEMORIAS } from "./tools/memoria";

/**
 * O fecho de uma conversa longa, guardado na memória da organização.
 *
 * É o ÚNICO lugar do épico em que um modelo é chamado fora da conversa — e por
 * isso nasce desligado (`astroConfig.resumirConversas`). Ligado, ele custa uma
 * chamada curta por conversa que passa de dez mensagens.
 *
 * O resumo é sobre a OPERAÇÃO, não sobre a pessoa: o que ficou combinado e o
 * que ela quis resolver. Nome, telefone e documento de cliente não entram —
 * memória não é cadastro paralelo.
 */

/** A partir de quantas mensagens vale resumir. Abaixo disso não há conversa. */
export const MENSAGENS_PARA_RESUMIR = 10;

/** Um resumo é uma frase. O teto está aqui para ele não virar ata. */
export const MAX_CARACTERES_DO_RESUMO = 300;

/** Quantos fechos de conversa a organização guarda. */
export const MAX_RESUMOS = 5;

const INSTRUCAO = `Resuma em UMA frase o que ficou desta conversa que sirva para as próximas: o que a pessoa quis resolver e o que ficou combinado. Não escreva nome, telefone, e-mail nem documento de ninguém. Não escreva números de venda ou de estoque, que mudam todo dia. Se não ficou nada que sirva depois, responda exatamente: NADA.`;

export async function resumirConversa(entrada: {
  organizationId: string;
  userId: string;
  sessaoId: string;
  modelo: ModeloResolvido;
  mensagens: readonly UIMessage[];
}): Promise<string | null> {
  const conversa = entrada.mensagens
    .slice(-MENSAGENS_PARA_RESUMIR)
    .map((mensagem) => {
      const texto = mensagem.parts
        .map((parte) => (parte.type === "text" ? parte.text : ""))
        .join(" ")
        .trim();
      return texto ? `${mensagem.role}: ${texto}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
  if (!conversa) return null;

  const { text } = await generateText({
    model: entrada.modelo.modelo,
    system: INSTRUCAO,
    prompt: conversa,
    maxOutputTokens: 120,
    temperature: 0.2,
  });

  const resumo = text.trim().slice(0, MAX_CARACTERES_DO_RESUMO);
  if (!resumo || resumo.toUpperCase().startsWith("NADA")) return null;

  const chave = `conversa-${entrada.sessaoId.slice(-8)}`;
  await prisma.astroMemoria.upsert({
    where: {
      organizationId_chave: { organizationId: entrada.organizationId, chave },
    },
    create: {
      organizationId: entrada.organizationId,
      chave,
      texto: resumo,
      origem: "resumo",
      criadoPorId: entrada.userId,
    },
    update: { texto: resumo },
  });

  // Só cinco resumos por organização: eles são o material mais perecível da
  // memória, e sem teto próprio empurrariam para fora os fatos que alguém
  // pediu para guardar.
  const resumos = await prisma.astroMemoria.findMany({
    where: { organizationId: entrada.organizationId, origem: "resumo" },
    orderBy: { updatedAt: "desc" },
    skip: MAX_RESUMOS,
    select: { id: true },
    take: MAX_MEMORIAS,
  });
  if (resumos.length > 0) {
    await prisma.astroMemoria.deleteMany({
      where: { id: { in: resumos.map((r) => r.id) } },
    });
  }

  return resumo;
}
