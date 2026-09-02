import { PARTNERS_SAMPLE_RESPONSE } from "@nerp/site-content";

/**
 * O conteúdo de ensaio da seção de parceiros.
 *
 * **Só fora de produção, e só com `?parceiros=demo` no endereço.** Existe
 * porque a seção some quando as listas estão vazias — que é a regra certa — e
 * sem isso não haveria como conferir o leiaute antes de o cliente preencher o
 * admin.
 *
 * O conjunto mora em `@nerp/site-content` porque o seed do `apps/web` escreve
 * exatamente ele: o que se vê aqui é o que o banco vai devolver.
 */
export const PARTNERS_PREVIEW = PARTNERS_SAMPLE_RESPONSE;
