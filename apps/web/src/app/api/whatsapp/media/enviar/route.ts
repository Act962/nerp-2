import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { enviarMidia } from "@/features/whatsapp-chat/server/enviar-midia";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/** Teto absoluto do corpo, acima de qualquer limite por tipo. */
const TETO_ABSOLUTO = 26 * 1024 * 1024;

export const runtime = "nodejs";

/**
 * Envio de arquivo pela conversa.
 *
 * É rota HTTP e não procedure oRPC de propósito: o oRPC transporta JSON, e um
 * vídeo de 16 MB viraria 21 MB de base64 — mais memória, mais tempo e um
 * limite de corpo estourado por causa da codificação, não do arquivo.
 * `multipart/form-data` manda os bytes como bytes.
 *
 * As mesmas duas barreiras da rota que **lê** mídia: sessão válida e conversa
 * confrontada com a organização antes de qualquer uso do id que veio do
 * cliente.
 */
export async function POST(request: NextRequest) {
  const cabecalhos = await headers();

  const session = await auth.api.getSession({ headers: cabecalhos });
  if (!session?.user?.id) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  const org = await auth.api.getFullOrganization({ headers: cabecalhos });
  if (!org) {
    return NextResponse.json({ erro: "Sem organização" }, { status: 403 });
  }

  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > TETO_ABSOLUTO) {
    // Recusado antes de ler o corpo: ler para depois rejeitar é justamente o
    // que um upload gigante quer que o servidor faça.
    return NextResponse.json(
      { erro: "Arquivo grande demais." },
      { status: 413 },
    );
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });
  }

  const conversationId = String(formulario.get("conversationId") ?? "");
  const legenda = String(formulario.get("legenda") ?? "").trim();
  const arquivo = formulario.get("arquivo");

  if (!conversationId || !(arquivo instanceof File)) {
    return NextResponse.json(
      { erro: "Informe a conversa e o arquivo." },
      { status: 400 },
    );
  }

  const conversa = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: org.id },
    select: { id: true },
  });
  if (!conversa) {
    return NextResponse.json(
      { erro: "Conversa não encontrada" },
      { status: 404 },
    );
  }

  const resultado = await enviarMidia({
    organizationId: org.id,
    conversationId: conversa.id,
    arquivo: Buffer.from(await arquivo.arrayBuffer()),
    mimetype: arquivo.type || "application/octet-stream",
    fileName: arquivo.name || undefined,
    legenda: legenda || undefined,
    autorId: session.user.id,
  });

  if (!resultado.ok) {
    const status = resultado.codigo === "FALHA_NO_ENVIO" ? 502 : 400;
    return NextResponse.json(
      { erro: resultado.mensagem, codigo: resultado.codigo },
      { status },
    );
  }

  return NextResponse.json({
    id: resultado.messageId,
    externalMessageId: resultado.externalMessageId,
    createdAt: resultado.createdAt.toISOString(),
  });
}
