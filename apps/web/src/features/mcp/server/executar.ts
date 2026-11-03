import "server-only";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Dependencias } from "@/features/mapeamento-banco/application/dependencias";
import { dependenciasDaOrg } from "@/features/mapeamento-banco/server/compor";
import { falhaConhecida } from "@/features/mapeamento-banco/server/erros";
import type { AgenteAutenticado } from "./autenticar";

export function texto(valor: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(valor) }] };
}

export function falha(mensagem: string): CallToolResult {
  return { content: [{ type: "text", text: mensagem }], isError: true };
}

/**
 * Monta as portas da org e roda o caso de uso. Erro vira resposta de
 * ferramenta (`isError`), não exceção: o agente lê o motivo e corrige o
 * pedido, em vez de a conversa quebrar.
 */
export async function executar(
  agente: AgenteAutenticado,
  casoDeUso: (deps: Dependencias) => Promise<unknown>,
): Promise<CallToolResult> {
  let deps: Dependencias;
  try {
    deps = await dependenciasDaOrg(agente.organizationId);
  } catch (erro) {
    const conhecida = falhaConhecida(erro);
    if (conhecida) return falha(conhecida.mensagem);
    throw erro;
  }
  try {
    return texto(await casoDeUso(deps));
  } catch (erro) {
    const conhecida = falhaConhecida(erro);
    if (conhecida) return falha(conhecida.mensagem);
    console.error("[mcp] falha ao executar a ferramenta:", erro);
    return falha(deps.banco.explicarFalha(erro));
  }
}
