import { GetObjectCommand } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";
import { S3 } from "@/lib/s3-client";
import { isSensitiveObjectKey } from "@/lib/s3-object-guard";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
  }

  // Esta rota não tem sessão (serve vitrine e catálogo público), então tudo
  // que for material criptográfico é recusado antes de tocar o bucket. Cobre
  // os certificados A1 que a rota antiga de upload gravou aqui.
  if (isSensitiveObjectKey(key)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: key,
    });
    const object = await S3.send(command);

    if (!object.Body) {
      return new NextResponse("Not found", { status: 404 });
    }

    const stream = object.Body.transformToWebStream();
    return new NextResponse(stream, {
      headers: {
        "Content-Type": object.ContentType ?? "image/jpeg",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
