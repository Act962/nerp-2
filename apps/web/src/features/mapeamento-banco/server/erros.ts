import "server-only";
import {
  LeituraRecusada,
  MapeamentoInvalido,
  TabelaNaoEncontrada,
} from "../application/dependencias";
import { SemBancoExterno } from "./compor";

export interface FalhaConhecida {
  tipo: "pedido" | "naoEncontrado";
  mensagem: string;
}

/**
 * Falhas que os casos de uso lançam DE PROPÓSITO, já com a mensagem certa para
 * quem está mapeando. Tudo o que não está aqui é falha do banco do cliente e
 * passa pelo `explicarFalha` do adaptador. Usado pela tela (oRPC) e pelo MCP —
 * as duas portas de entrada traduzem igual.
 */
export function falhaConhecida(erro: unknown): FalhaConhecida | null {
  if (erro instanceof TabelaNaoEncontrada) {
    return { tipo: "naoEncontrado", mensagem: erro.message };
  }
  if (erro instanceof MapeamentoInvalido) {
    return { tipo: "pedido", mensagem: erro.erros.join(" ") };
  }
  if (erro instanceof LeituraRecusada || erro instanceof SemBancoExterno) {
    return { tipo: "pedido", mensagem: erro.message };
  }
  return null;
}
