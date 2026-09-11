import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { chavePertenceAOrg } from "@/features/uploads/server/posse";
import { getApiSession } from "@/lib/api-auth";
import { auth } from "@/lib/auth";
import { S3 } from "@/lib/s3-client";

const corpoSchema = z.object({ key: z.string().min(1).max(512) });

/**
 * Apaga um objeto do bucket — só se ele for da organização ativa.
 *
 * Antes, qualquer sessão apagava qualquer chave: o bucket é um só para todos
 * os inquilinos, e a chave da foto de um produto aparece na URL pública. A
 * posse vem do prefixo `<orgId>/` (chaves novas) ou de uma linha da org que
 * referencia a chave (chaves antigas) — ver `features/uploads/server/posse.ts`.
 */
export async function DELETE(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const org = await auth.api
    .getFullOrganization({ headers: request.headers })
    .catch(() => null);
  if (!org) {
    return NextResponse.json({ error: "Sem organização" }, { status: 403 });
  }

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json(
      { error: "Missing or invalid object key" },
      { status: 400 },
    );
  }
  const { key } = corpo.data;

  if (!(await chavePertenceAOrg(org.id, key))) {
    return NextResponse.json(
      { error: "Este arquivo não pertence à sua organização" },
      { status: 403 },
    );
  }

  try {
    await S3.send(
      new DeleteObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
        Key: key,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível apagar o arquivo" },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "File deleted successfully" });
}
