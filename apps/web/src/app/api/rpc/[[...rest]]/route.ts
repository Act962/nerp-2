import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { router } from "@/app/router";
import { verifyNasaS2S } from "@/lib/nasa-s2s-verify";
import { verifyDeviceAuth } from "@/lib/device-auth-verify";
import { desktopCorsHeaders } from "@/lib/desktop-cors";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handleRequest(request: Request) {
  const cors = desktopCorsHeaders(request.headers.get("origin"));

  let s2s: Awaited<ReturnType<typeof verifyNasaS2S>> = null;
  try {
    s2s = await verifyNasaS2S(request);
  } catch (err) {
    if (err instanceof Response) return withHeaders(err, cors);
    throw err;
  }

  // Bearer de device só quando não é S2S (o S2S usa headers próprios).
  const device = s2s ? null : await verifyDeviceAuth(request);

  const { response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: {
      headers: request.headers,
      ...(s2s && {
        isS2S: true as const,
        s2sOrg: s2s.org,
        s2sUser: s2s.user,
        s2sScopes: s2s.scopes,
      }),
      ...(device && {
        isDevice: true as const,
        deviceOrg: device.org,
        deviceUser: device.user,
        deviceScopes: device.scopes,
      }),
    },
  });

  return withHeaders(
    response ?? new Response("Not found", { status: 404 }),
    cors,
  );
}

function withHeaders(
  response: Response,
  headers: Record<string, string>,
): Response {
  if (Object.keys(headers).length === 0) return response;
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

// Preflight CORS do desktop (cross-origin). Web same-origin não dispara isto.
export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: desktopCorsHeaders(request.headers.get("origin")),
  });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
