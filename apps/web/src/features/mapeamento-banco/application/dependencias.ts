import type { BancoDeDadosPort } from "../ports/banco";
import type { DestinoNoNerpPort } from "../ports/destino";
import type { ConferenciaNoNerpPort } from "../ports/nerp";
import type { MapeamentoRepositorio } from "../ports/repositorio";
import type { VocabularioPort } from "../ports/vocabulario";

// Os casos de uso recebem as portas prontas e nunca importam adaptador: quem
// monta as peças para uma organização é `server/compor.ts`. É isso que deixa
// testar um caso de uso com um banco falso, sem Oracle.

export interface Dependencias {
  banco: BancoDeDadosPort;
  vocabulario: VocabularioPort;
  repositorio: MapeamentoRepositorio;
  nerp: ConferenciaNoNerpPort;
  /** Onde a importação grava. Só os casos de uso de importação usam. */
  destino: DestinoNoNerpPort;
}

/** Pedido que fere uma regra de leitura (ex.: filtro sem índice em tabela grande). */
export class LeituraRecusada extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "LeituraRecusada";
  }
}

export class TabelaNaoEncontrada extends Error {
  constructor(nome: string) {
    super(
      `A tabela ${nome} não existe ou não está acessível para esta credencial.`,
    );
    this.name = "TabelaNaoEncontrada";
  }
}

export class MapeamentoInvalido extends Error {
  constructor(readonly erros: string[]) {
    super(erros[0] ?? "Mapeamento inválido.");
    this.name = "MapeamentoInvalido";
  }
}
