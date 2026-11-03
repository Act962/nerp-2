import type { Mapeamento } from "../domain/mapeamento";

/** Onde o mapeamento de UMA organização fica guardado. */
export interface MapeamentoRepositorio {
  carregar(): Promise<Mapeamento>;
  salvar(mapeamento: Mapeamento): Promise<void>;
}
