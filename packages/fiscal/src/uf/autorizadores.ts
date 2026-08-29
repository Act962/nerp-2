import { type Uf, UFS } from "./uf";

/**
 * Qual SEFAZ autoriza o documento de cada UF.
 *
 * Poucos estados operam webservice próprio; o resto delega a uma SEFAZ Virtual
 * (SVRS, SVAN) ou ao Ambiente Nacional. **E o autorizador muda conforme o
 * modelo**: BA, MA e PE autorizam a própria NF-e (55) mas mandam a NFC-e (65)
 * para a SVRS.
 *
 * Essa divergência é a razão deste módulo existir em vez de reusarmos o mapa da
 * `@brasil-fiscal/nfe`: o `getSefazUrl` dela consulta sempre a tabela do modelo
 * 55, então uma NFC-e da Bahia seria roteada para o autorizador BA — que não
 * tem endpoint de NFC-e — e uma do Maranhão iria para a SVAN, que não atende
 * modelo 65.
 *
 * As URLs NÃO moram aqui de propósito: este pacote roda também na webview do
 * Tauri, e o dispositivo nunca fala com a SEFAZ (ele monta o XML, o servidor
 * assina e transmite). Só o driver do servidor precisa de endpoint.
 *
 * Fonte: `nfephp-org/sped-nfe`, `storage/autorizadores.json`.
 */

export const AUTORIZADORES = [
  "AM",
  "BA",
  "GO",
  "MG",
  "MS",
  "MT",
  "PE",
  "PR",
  "RS",
  "SP",
  "SVAN",
  "SVRS",
  /** Sefaz Virtual de Contingência — Ambiente Nacional (NF-e). */
  "SVC-AN",
  /** Sefaz Virtual de Contingência — Rio Grande do Sul (NF-e). */
  "SVC-RS",
  /** Ambiente Nacional: DistribuiçãoDFe e manifestação do destinatário. */
  "AN",
] as const;

export type Autorizador = (typeof AUTORIZADORES)[number];

/** NF-e modelo 55. */
const AUTORIZADOR_NFE: Record<Uf, Autorizador> = {
  AC: "SVRS",
  AL: "SVRS",
  AM: "AM",
  AP: "SVRS",
  BA: "BA",
  CE: "SVRS",
  DF: "SVRS",
  ES: "SVRS",
  GO: "GO",
  MA: "SVAN",
  MG: "MG",
  MS: "MS",
  MT: "MT",
  PA: "SVRS",
  PB: "SVRS",
  PE: "PE",
  PI: "SVRS",
  PR: "PR",
  RJ: "SVRS",
  RN: "SVRS",
  RO: "SVRS",
  RR: "SVRS",
  RS: "RS",
  SC: "SVRS",
  SE: "SVRS",
  SP: "SP",
  TO: "SVRS",
};

/** NFC-e modelo 65 — BA, MA e PE diferem do modelo 55. */
const AUTORIZADOR_NFCE: Record<Uf, Autorizador> = {
  ...AUTORIZADOR_NFE,
  BA: "SVRS",
  MA: "SVRS",
  PE: "SVRS",
};

/** Autorizador da UF para o modelo informado. */
export function autorizadorDe(uf: Uf, modelo: 55 | 65): Autorizador {
  return modelo === 65 ? AUTORIZADOR_NFCE[uf] : AUTORIZADOR_NFE[uf];
}

/**
 * Autorizador de contingência da NF-e (modelo 55).
 *
 * Quem já é autorizado pela SVRS cai na SVC-AN; os demais na SVC-RS — uma
 * contingência não pode apontar para o ambiente que está fora do ar.
 *
 * **A NFC-e não tem SVC.** Quando a SEFAZ cai, o modelo 65 vai para
 * contingência OFFLINE (`tpEmis=9`), que é justamente o caminho do PDV sem
 * internet. Por isso esta função recusa o modelo 65 em vez de devolver algo.
 */
export function autorizadorContingencia(uf: Uf, modelo: 55 | 65): Autorizador {
  if (modelo === 65)
    throw new Error(
      "NFC-e não tem SEFAZ Virtual de Contingência: use contingência offline (tpEmis=9)",
    );
  return AUTORIZADOR_NFE[uf] === "SVRS" ? "SVC-AN" : "SVC-RS";
}

/** UFs atendidas por um autorizador, no modelo informado. */
export function ufsDoAutorizador(
  autorizador: Autorizador,
  modelo: 55 | 65,
): Uf[] {
  return UFS.filter((uf) => autorizadorDe(uf, modelo) === autorizador);
}
