import type { Pendencia } from "./erros";
import { CSOSN, CST_ICMS, CST_PIS_COFINS_VALIDO, codigos } from "./tabelas";
import { cnpjValido, documentoValido, gtinValido } from "./identificadores";
import {
  type NotaFiscal,
  calcularTotais,
  usaCsosn,
  valorBrutoItem,
} from "./nota-fiscal";

/**
 * Confere a nota ANTES de reservar número e de falar com o provedor.
 *
 * Tudo o que dá para saber localmente é barrado aqui: cada rejeição evitada é
 * um número que não precisa ser inutilizado e um caixa que não fica esperando
 * a SEFAZ responder o óbvio. A lista volta inteira (não para no primeiro erro)
 * para a tela mostrar todos os produtos a corrigir de uma vez.
 *
 * Valida FORMATO e coerência. Se o NCM é o certo para aquele produto, ou se o
 * CSOSN está correto, é decisão do contador — não temos como saber.
 */

const CSOSN_VALIDOS = codigos(CSOSN);
const CST_ICMS_VALIDOS = codigos(CST_ICMS);

export function validarNotaParaEmissao(nota: NotaFiscal): Pendencia[] {
  const p: Pendencia[] = [];
  const add = (campo: string, mensagem: string, itemIndice?: number) =>
    p.push(
      itemIndice === undefined
        ? { campo, mensagem }
        : { campo, mensagem, itemIndice },
    );

  const { emitente } = nota;
  if (!cnpjValido(emitente.cnpj))
    add("emitente.cnpj", "CNPJ do emitente inválido");
  if (!emitente.inscricaoEstadual.trim())
    add("emitente.inscricaoEstadual", "Informe a Inscrição Estadual");
  if (!emitente.razaoSocial.trim())
    add("emitente.razaoSocial", "Informe a razão social");
  if (!/^\d{7}$/.test(emitente.endereco.codigoMunicipio))
    add(
      "emitente.endereco.codigoMunicipio",
      "Código IBGE do município precisa ter 7 dígitos",
    );
  if (!/^\d{8}$/.test(emitente.endereco.cep.replace(/\D/g, "")))
    add("emitente.endereco.cep", "CEP precisa ter 8 dígitos");
  for (const campo of ["logradouro", "numero", "bairro"] as const)
    if (!emitente.endereco[campo].trim())
      add(`emitente.endereco.${campo}`, `Informe o ${campo} do endereço`);

  if (nota.destinatario && !documentoValido(nota.destinatario.documento))
    add("destinatario.documento", "CPF/CNPJ do cliente inválido");

  if (nota.itens.length === 0)
    add("itens", "A nota precisa de ao menos um item");

  const csosn = usaCsosn(emitente.regime);
  nota.itens.forEach((item, i) => {
    const c = (campo: string) => `itens[${i}].${campo}`;
    const nome = item.descricao || item.codigo;

    if (!/^\d{8}$/.test(item.ncm))
      add(c("ncm"), `${nome}: NCM precisa ter 8 dígitos`, i);
    if (item.cest && !/^\d{7}$/.test(item.cest))
      add(c("cest"), `${nome}: CEST precisa ter 7 dígitos`, i);
    if (!/^\d{4}$/.test(item.cfop))
      add(c("cfop"), `${nome}: CFOP precisa ter 4 dígitos`, i);
    else if (nota.modelo === 65 && !item.cfop.startsWith("5"))
      // NFC-e é sempre venda presencial dentro do estado.
      add(
        c("cfop"),
        `${nome}: NFC-e só aceita CFOP de operação interna (5xxx)`,
        i,
      );
    if (item.gtin && !gtinValido(item.gtin))
      add(c("gtin"), `${nome}: código de barras (GTIN) inválido`, i);
    if (!item.unidade.trim())
      add(c("unidade"), `${nome}: informe a unidade`, i);
    if (!(item.quantidade > 0))
      add(c("quantidade"), `${nome}: quantidade precisa ser maior que zero`, i);
    if (!(item.valorUnitario > 0))
      add(
        c("valorUnitario"),
        `${nome}: valor unitário precisa ser maior que zero`,
        i,
      );
    if (item.desconto < 0 || item.desconto >= valorBrutoItem(item))
      add(
        c("desconto"),
        `${nome}: desconto precisa ser menor que o valor do item`,
        i,
      );

    const t = item.tributacao;
    if (!/^[0-8]$/.test(t.origem))
      add(c("tributacao.origem"), `${nome}: origem da mercadoria inválida`, i);
    if (csosn) {
      if (t.icms.regime !== "SIMPLES" || !CSOSN_VALIDOS.has(t.icms.csosn))
        add(
          c("tributacao.icms"),
          `${nome}: empresa do Simples precisa de CSOSN válido`,
          i,
        );
    } else if (
      t.icms.regime !== "NORMAL" ||
      !CST_ICMS_VALIDOS.has(t.icms.cst)
    ) {
      add(
        c("tributacao.icms"),
        `${nome}: empresa do Regime Normal precisa de CST de ICMS válido`,
        i,
      );
    }
    if (!CST_PIS_COFINS_VALIDO.test(t.pis.cst))
      add(c("tributacao.pis"), `${nome}: CST de PIS inválido`, i);
    if (!CST_PIS_COFINS_VALIDO.test(t.cofins.cst))
      add(c("tributacao.cofins"), `${nome}: CST de COFINS inválido`, i);
  });

  const totais = calcularTotais(nota);
  if (nota.itens.length > 0 && totais.total <= 0)
    add("total", "O total da nota precisa ser maior que zero");
  if (nota.pagamentos.length === 0)
    add("pagamentos", "Informe a forma de pagamento");
  else if (totais.pago < totais.total)
    add("pagamentos", "Os pagamentos não cobrem o total da nota");

  return p;
}
