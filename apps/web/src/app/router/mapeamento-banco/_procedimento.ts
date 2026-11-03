import { ORPCError } from "@orpc/server";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireMapeamentoBancoMiddleware } from "@/app/middlewares/mapeamento-banco";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Dependencias } from "@/features/mapeamento-banco/application/dependencias";
import { dependenciasDaOrg } from "@/features/mapeamento-banco/server/compor";
import { falhaConhecida } from "@/features/mapeamento-banco/server/erros";

export const procedimento = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireMapeamentoBancoMiddleware);

function erroDoOrpc(erro: unknown): ORPCError<string, unknown> | null {
  const falha = falhaConhecida(erro);
  if (!falha) return null;
  return new ORPCError(
    falha.tipo === "naoEncontrado" ? "NOT_FOUND" : "BAD_REQUEST",
    { message: falha.mensagem },
  );
}

/**
 * Monta as portas da org e roda o caso de uso, traduzindo cada falha para um
 * erro do oRPC com mensagem em português. Falha do banco do cliente nunca
 * chega crua (ORA-xxxxx) à tela, nem como 500: vai a mensagem do adaptador.
 *
 * `ORPCError` direto (como em `erp-sync/_access.ts`) porque isto roda fora do
 * handler, onde o `errors` tipado não existe.
 */
export async function executar<T>(
  organizationId: string,
  casoDeUso: (deps: Dependencias) => Promise<T>,
): Promise<T> {
  let deps: Dependencias;
  try {
    deps = await dependenciasDaOrg(organizationId);
  } catch (erro) {
    throw erroDoOrpc(erro) ?? erro;
  }

  try {
    return await casoDeUso(deps);
  } catch (erro) {
    const conhecido = erroDoOrpc(erro);
    if (conhecido) throw conhecido;
    console.error("[mapeamento-banco] falha no banco do ERP:", erro);
    throw new ORPCError("BAD_REQUEST", {
      message: deps.banco.explicarFalha(erro),
    });
  }
}
