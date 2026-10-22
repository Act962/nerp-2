import type { TipoDoNerp } from "../domain/alvos";
import type { PerfilAutomatico } from "../domain/perfis";

// O que se sabe de um ERP específico: o nome de negócio das tabelas e colunas
// ("PCPRODUT" → "Produtos") e os perfis automáticos. Separado do banco porque
// são eixos diferentes — o mesmo Oracle pode hospedar outro ERP, e um ERP
// conhecido pode trocar de motor.

export interface Rotulo {
  rotulo: string;
  descricao: string;
}

export interface VocabularioPort {
  readonly nome: string;
  tabela(nome: string): Rotulo | null;
  coluna(nome: string): Rotulo | null;
  /** Em ordem de preferência: vale o primeiro que a credencial enxerga. */
  perfis(tipo: TipoDoNerp): PerfilAutomatico[];
}

/** Banco sem ERP conhecido: só mapeamento manual, sem rótulos. */
export const VOCABULARIO_VAZIO: VocabularioPort = {
  nome: "Banco de dados",
  tabela: () => null,
  coluna: () => null,
  perfis: () => [],
};
