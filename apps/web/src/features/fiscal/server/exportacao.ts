import "server-only";

import { calcularTotais, type NotaFiscal } from "@nerp/fiscal";
import { strToU8, zipSync } from "fflate";
import prisma from "@/lib/db";
import { faixaDoMes } from "./consultas";

/**
 * O pacote mensal que o contador pede: todo XML autorizado, cancelado e de
 * inutilização do mês, mais um resumo em CSV que abre direto no Excel (`;` e
 * vírgula decimal).
 *
 * A data que conta é a da AUTORIZAÇÃO (é a que vai para o SPED); a
 * inutilização entra pela data em que a SEFAZ a registrou.
 */
export async function montarPacoteDoMes(input: {
  organizationId: string;
  mes: string;
  ler: (key: string) => Promise<Buffer | null>;
}): Promise<{ zip: Uint8Array; notas: number; faltando: number }> {
  const { de, ate } = faixaDoMes(input.mes);
  const [documentos, inutilizacoes] = await Promise.all([
    prisma.fiscalDocument.findMany({
      where: {
        organizationId: input.organizationId,
        authorizedAt: { gte: de, lt: ate },
        status: { in: ["AUTHORIZED", "CANCELLED"] },
      },
      orderBy: [{ serie: "asc" }, { numero: "asc" }],
    }),
    prisma.fiscalInutilizacao.findMany({
      where: {
        organizationId: input.organizationId,
        inutilizadaEm: { gte: de, lt: ate },
      },
      orderBy: { numeroInicial: "asc" },
    }),
  ]);

  const arquivos: Record<string, Uint8Array> = {};
  let faltando = 0;
  async function incluir(caminho: string, key: string | null) {
    const bytes = key ? await input.ler(key) : null;
    if (bytes) arquivos[caminho] = new Uint8Array(bytes);
    else faltando += 1;
  }

  const linhas = [
    "modelo;serie;numero;chave;situacao;autorizada_em;valor;protocolo;cancelada_em;justificativa_cancelamento",
  ];
  for (const d of documentos) {
    const pasta = d.status === "CANCELLED" ? "canceladas" : "autorizadas";
    const nome = d.chave ?? `${d.serie}-${d.numero}`;
    await incluir(`${pasta}/${nome}-nfce.xml`, d.xmlKey);
    if (d.status === "CANCELLED")
      await incluir(`${pasta}/${nome}-cancelamento.xml`, d.cancelXmlKey);

    const nota = d.nota as unknown as NotaFiscal | null;
    const total = nota?.itens ? calcularTotais(nota).total : 0;
    linhas.push(
      [
        d.type === "NFCE" ? "65" : "55",
        d.serie,
        d.numero,
        d.chave ?? "",
        d.status === "CANCELLED" ? "cancelada" : "autorizada",
        dataHora(d.authorizedAt),
        (total / 100).toFixed(2).replace(".", ","),
        d.protocolo ?? "",
        dataHora(d.cancelledAt),
        csv(d.cancelReason ?? ""),
      ].join(";"),
    );
  }
  for (const i of inutilizacoes) {
    await incluir(
      `inutilizadas/serie-${i.serie}-${i.numeroInicial}-a-${i.numeroFinal}.xml`,
      i.xmlKey,
    );
    linhas.push(
      [
        i.type === "NFCE" ? "65" : "55",
        i.serie,
        `${i.numeroInicial}-${i.numeroFinal}`,
        "",
        "inutilizada",
        dataHora(i.inutilizadaEm),
        "",
        i.protocolo,
        "",
        csv(i.justificativa),
      ].join(";"),
    );
  }

  // BOM: sem ele o Excel abre o CSV em Latin-1 e estraga a acentuação.
  arquivos["resumo.csv"] = strToU8(`${BOM}${linhas.join("\r\n")}\r\n`);
  return { zip: zipSync(arquivos), notas: documentos.length, faltando };
}

const BOM = String.fromCharCode(0xfeff);

function dataHora(d: Date | null): string {
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "";
}

function csv(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}
