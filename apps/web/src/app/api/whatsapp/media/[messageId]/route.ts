import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  lerMidia,
  pertenceAOrg,
} from "@/features/whatsapp-chat/lib/media-storage";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Serve o arquivo de uma mensagem.
 *
 * A mídia mora em bucket **privado** e nunca vira URL pública: todo acesso
 * passa por aqui, que confere sessão e organização antes de ler o objeto. É a
 * diferença entre uma foto que um cliente mandou no WhatsApp ser visível só
 * para a loja dela e ser baixável por quem adivinhar a chave.
 *
 * Duas barreiras, de propósito: a consulta filtra por `organizationId`, e a
 * chave é conferida contra o prefixo da organização. A segunda pega o caso de
 * uma linha gravada com chave de outro tenant por bug em outro caminho.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const org = await auth.api.getFullOrganization({ headers: await headers() });
  if (!org) return new NextResponse("Forbidden", { status: 403 });

  const { messageId } = await params;

  const mensagem = await prisma.message.findFirst({
    where: { id: messageId, organizationId: org.id },
    select: { mediaKey: true, mimetype: true, fileName: true },
  });

  if (!mensagem?.mediaKey) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!pertenceAOrg(mensagem.mediaKey, org.id)) {
    console.error("[whatsapp:media] chave_de_outra_organizacao", {
      messageId,
      organizationId: org.id,
    });
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const { corpo, contentType } = await lerMidia(mensagem.mediaKey);
    return new NextResponse(new Uint8Array(corpo), {
      status: 200,
      headers: {
        "content-type": mensagem.mimetype ?? contentType,
        // Privado e por sessão: nada de cache compartilhado.
        "cache-control": "private, max-age=3600",
        ...(mensagem.fileName
          ? {
              "content-disposition": `inline; filename="${encodeURIComponent(mensagem.fileName)}"`,
            }
          : {}),
      },
    });
  } catch (error) {
    console.error("[whatsapp:media] leitura_falhou", { messageId, error });
    return new NextResponse("Not found", { status: 404 });
  }
}
