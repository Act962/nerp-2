import { type NextRequest, NextResponse } from "next/server";
import {
  acessoFiscal,
  respostaXml,
} from "@/features/fiscal/server/acesso-http";
import { lerArquivoFiscal } from "@/features/fiscal/server/container";
import prisma from "@/lib/db";
import { belongsToOrg } from "@/lib/fiscal/storage";

/**
 * XML de uma nota (`?tipo=nota`), do evento de cancelamento
 * (`?tipo=cancelamento`) ou de uma inutilização (`?tipo=inutilizacao`, com o
 * id da inutilização). Bucket privado: tudo passa por aqui, que confere a
 * organização na consulta E no prefixo da key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const acesso = await acessoFiscal();
  if (!acesso.ok) return acesso.resposta;
  const { id } = await params;
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "nota";
  const organizationId = acesso.organizationId;

  let key: string | null = null;
  let nome = "nota.xml";
  if (tipo === "inutilizacao") {
    const inut = await prisma.fiscalInutilizacao.findFirst({
      where: { id, organizationId },
      select: {
        xmlKey: true,
        serie: true,
        numeroInicial: true,
        numeroFinal: true,
      },
    });
    key = inut?.xmlKey ?? null;
    if (inut)
      nome = `inutilizacao-serie-${inut.serie}-${inut.numeroInicial}-a-${inut.numeroFinal}.xml`;
  } else {
    const doc = await prisma.fiscalDocument.findFirst({
      where: { id, organizationId },
      select: { xmlKey: true, cancelXmlKey: true, chave: true, numero: true },
    });
    key = (tipo === "cancelamento" ? doc?.cancelXmlKey : doc?.xmlKey) ?? null;
    const base = doc?.chave ?? `nfce-${doc?.numero ?? id}`;
    nome =
      tipo === "cancelamento" ? `${base}-cancelamento.xml` : `${base}-nfce.xml`;
  }

  if (!key) return new NextResponse("XML não encontrado", { status: 404 });
  if (!belongsToOrg(key, organizationId)) {
    console.error("[fiscal:xml] chave_de_outra_organizacao", {
      id,
      organizationId,
    });
    return new NextResponse("Forbidden", { status: 403 });
  }
  const bytes = await lerArquivoFiscal(key);
  if (!bytes) return new NextResponse("XML indisponível", { status: 404 });
  return respostaXml(bytes, nome);
}
