import "server-only";
import {
  describeColumn,
  describeTable,
} from "@/features/erp-sync/server/oracle-explorer/glossary";
import type { Rotulo, VocabularioPort } from "../../ports/vocabulario";
import { PERFIS_DO_WINTHOR } from "./perfis";

// Reaproveita o glossário do dashboard (`oracle-explorer/glossary.ts`): o nome
// de negócio de uma tabela do Winthor é o mesmo nas duas telas.

function rotuloOuNada(
  termo: { label: string; description: string },
  nome: string,
): Rotulo | null {
  // O glossário devolve o próprio nome quando não conhece o termo.
  if (termo.label === nome) return null;
  return { rotulo: termo.label, descricao: termo.description };
}

export const VOCABULARIO_WINTHOR: VocabularioPort = {
  nome: "Winthor",
  tabela: (nome) => rotuloOuNada(describeTable(nome), nome),
  coluna: (nome) => rotuloOuNada(describeColumn(nome), nome),
  perfis: (tipo) => PERFIS_DO_WINTHOR[tipo],
};
