import { z } from "zod";
import { NICHO_IDS } from "./nichos";
import { ORG_SEGMENTS } from "@/lib/org-segment";
import { SOLUCAO_IDS } from "./solucoes";

/**
 * O que o wizard "Começar agora" responde, do jeito que viaja da tela ao
 * servidor: num cookie curto, porque a organização só nasce no `after` do
 * `POST /sign-in/anonymous` — e o corpo desse POST é do Better Auth.
 *
 * Tudo opcional: pular os dois passos ainda cria a organização.
 */

export const RESPOSTAS_COOKIE = "nerp_comecar";

export const respostasDoWizardSchema = z.object({
  segment: z.enum(ORG_SEGMENTS).optional(),
  nicho: z.enum(NICHO_IDS).optional(),
  interesses: z.array(z.enum(SOLUCAO_IDS)).max(12).default([]),
});

export type RespostasDoWizard = z.infer<typeof respostasDoWizardSchema>;

export const RESPOSTAS_VAZIAS: RespostasDoWizard = { interesses: [] };

/** Codifica para o cookie (URL-safe; o cookie não aceita `;` e `,` cruas). */
export function codificarRespostas(respostas: RespostasDoWizard): string {
  return encodeURIComponent(JSON.stringify(respostas));
}

/** Lê o cookie com tolerância: valor estranho vira respostas vazias. */
export function lerRespostasDoWizard(
  valor: string | null | undefined,
): RespostasDoWizard {
  if (!valor) return RESPOSTAS_VAZIAS;
  try {
    const parsed = respostasDoWizardSchema.safeParse(
      JSON.parse(decodeURIComponent(valor)),
    );
    return parsed.success ? parsed.data : RESPOSTAS_VAZIAS;
  } catch {
    return RESPOSTAS_VAZIAS;
  }
}
