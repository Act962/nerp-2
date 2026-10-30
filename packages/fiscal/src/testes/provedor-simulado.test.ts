import { testarContratoDoProvedorFiscal } from "./contrato";
import { notaDeExemplo } from "./nota-de-exemplo";
import { NCM_INEXISTENTE, ProvedorFiscalSimulado } from "./provedor-simulado";

let sequencia = 0;
const numeracao = () => {
  sequencia += 1;
  return { serie: 1, numero: sequencia };
};
const novaRef = () => `ref-${sequencia}-${Math.random().toString(36).slice(2)}`;

function notaRejeitavel() {
  const nota = notaDeExemplo();
  nota.itens[0] = { ...nota.itens[0], ncm: NCM_INEXISTENTE };
  return nota;
}

testarContratoDoProvedorFiscal("simulado (imediato)", {
  criarProvedor: () => new ProvedorFiscalSimulado(),
  notaValida: () => notaDeExemplo(),
  notaRejeitavel,
  proximaNumeracao: numeracao,
  novaRef,
});

testarContratoDoProvedorFiscal("simulado (SEFAZ assíncrona)", {
  criarProvedor: () => new ProvedorFiscalSimulado({ modo: "ASSINCRONO" }),
  notaValida: () => notaDeExemplo(),
  notaRejeitavel,
  proximaNumeracao: numeracao,
  novaRef,
});
