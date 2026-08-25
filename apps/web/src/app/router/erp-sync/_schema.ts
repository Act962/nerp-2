import z from "zod";

// Campos de conexão do Winthor/Oracle vindos do formulário. `password` é
// opcional no update: em branco = mantém a senha já cifrada (o get nunca
// devolve a senha, então o form não teria como reenviá-la).
export const winthorConnectionInputSchema = z.object({
  host: z.string().min(1, "Informe o host"),
  port: z.number().int().positive().max(65535).default(1521),
  serviceName: z.string().min(1, "Informe o service name"),
  // O schema vira parte da SQL (não pode ser bind); o conector revalida com
  // regex de identificador Oracle antes de usar.
  schema: z
    .string()
    .min(1, "Informe o schema")
    .regex(/^[A-Za-z][A-Za-z0-9_$#]{0,29}$/, "Schema Oracle inválido"),
  user: z.string().min(1, "Informe o usuário"),
  password: z.string().optional(),
});

export type WinthorConnectionInput = z.infer<
  typeof winthorConnectionInputSchema
>;
