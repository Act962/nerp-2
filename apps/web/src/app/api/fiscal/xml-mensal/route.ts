import { type NextRequest, NextResponse } from "next/server";
import { acessoFiscal } from "@/features/fiscal/server/acesso-http";
import { lerArquivoFiscal } from "@/features/fiscal/server/container";
import { montarPacoteDoMes } from "@/features/fiscal/server/exportacao";
import { belongsToOrg } from "@/lib/fiscal/storage";

/**
 * `?mes=2026-10` → zip com os XMLs do mês e o resumo em CSV, para o contador.
 * Só owner/admin: é o pacote fiscal inteiro da empresa.
 */
export async function GET(request: NextRequest) {
  const acesso = await acessoFiscal();
  if (!acesso.ok) return acesso.resposta;
  if (!acesso.acessoTotal)
    return new NextResponse("Apenas owner/admin exportam os XMLs", {
      status: 403,
    });

  const mes = request.nextUrl.searchParams.get("mes") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes))
    return new NextResponse("Mês inválido (use AAAA-MM)", { status: 400 });

  const organizationId = acesso.organizationId;
  const { zip } = await montarPacoteDoMes({
    organizationId,
    mes,
    ler: (key) =>
      belongsToOrg(key, organizationId)
        ? lerArquivoFiscal(key)
        : Promise.resolve(null),
  });

  return new NextResponse(zip.slice().buffer, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="xmls-fiscais-${mes}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
