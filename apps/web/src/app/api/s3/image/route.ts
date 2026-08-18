import { GetObjectCommand } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";
import { S3 } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
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
