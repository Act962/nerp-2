import { notaDeExemplo } from "@nerp/fiscal/testes";
import { testarContratoDoProvedorFiscal } from "@nerp/fiscal/testes/contrato";
import { describe } from "vitest";
import { ProvedorFocus } from "./provedor";

/**
 * O MESMO contrato de `provedor.test.ts`, agora contra a homologação de
 * verdade da Focus/SEFAZ. Fica desligado sem as variáveis — `pnpm test` e o CI
 * nunca falam com a Focus. Para rodar (empresa cadastrada e credenciada para
 * NFC-e na SEFAZ, com CSC de homologação):
 *
 *   FOCUS_HOMOLOG_TOKEN=<token_homologacao da empresa> \
 *   FOCUS_HOMOLOG_CNPJ=<cnpj> FOCUS_HOMOLOG_IE=<ie> \
 *   pnpm --filter @nerp/web exec vitest run provedor.homologacao
 *
 * Usa a série `FOCUS_HOMOLOG_SERIE` (padrão 99) e números tirados do relógio,
 * para não colidir com as notas de teste feitas pelo PDV na série 1. Notas de
 * homologação não têm valor fiscal; os números pulados ficam pulados.
 */
const token = process.env.FOCUS_HOMOLOG_TOKEN;
const cnpj = process.env.FOCUS_HOMOLOG_CNPJ?.replace(/\D/g, "") ?? "";
const ie = process.env.FOCUS_HOMOLOG_IE?.replace(/\D/g, "") ?? "";
const serie = Number(process.env.FOCUS_HOMOLOG_SERIE ?? 99);

const base = notaDeExemplo();
const emitente = {
  ...base.emitente,
  cnpj,
  inscricaoEstadual: ie,
  razaoSocial: process.env.FOCUS_HOMOLOG_RAZAO ?? base.emitente.razaoSocial,
};

let sequencia = 0;
const numeroInicial = Math.floor(Date.now() / 1000) % 900_000_000;

describe.skipIf(!token || !cnpj || !ie)("Focus NFe — homologação real", () => {
  testarContratoDoProvedorFiscal("Focus (homologação)", {
    criarProvedor: () =>
      new ProvedorFocus({ token: token ?? "", ambiente: "HOMOLOGACAO" }),
    notaValida: () => notaDeExemplo({ emitente }),
    // A Focus pode barrar o NCM inexistente antes da SEFAZ (422, vira
    // ErroFiscal) — se este caso falhar assim, é um achado do contrato, não
    // ruído: o adaptador teria de tratar a validação da Focus como rejeição.
    notaRejeitavel: () =>
      notaDeExemplo({
        emitente,
        itens: base.itens.map((item) => ({ ...item, ncm: "00000000" })),
      }),
    proximaNumeracao: () => ({ serie, numero: numeroInicial + sequencia++ }),
    novaRef: () => `contrato-${Date.now()}-${sequencia++}`,
    intervaloConsultaMs: 3_000,
    maxConsultas: 10,
    timeoutMs: 60_000,
  });
});
