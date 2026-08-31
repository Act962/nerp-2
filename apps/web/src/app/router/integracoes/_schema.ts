import z from "zod";

// As credenciais chegam como mapa aberto de propósito: o formulário é derivado
// do manifesto, então o conjunto de chaves varia por provedor. A validação do
// que é obrigatório acontece contra o manifesto, no handler.
export const credenciaisInputSchema = z.object({
  providerId: z.string().min(1),
  /** "" = a instalação única do provedor nesta organização. */
  externalRef: z.string().default(""),
  displayName: z.string().trim().max(80).optional(),
  environment: z.enum(["sandbox", "producao"]).default("producao"),
  valores: z.record(z.string(), z.string()),
});

export type CredenciaisInput = z.infer<typeof credenciaisInputSchema>;
