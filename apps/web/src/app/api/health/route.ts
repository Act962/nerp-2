import { desktopCorsHeaders } from "@/lib/desktop-cors";

/**
 * Health check leve para o desktop distinguir "sem rede" de "server fora".
 *
 * Não toca no banco — responde na hora. Tem CORS do desktop (cross-origin) e
 * `no-store` para o browser nunca servir do cache e mascarar uma queda.
 */
function respond(origin: string | null) {
  return Response.json(
    { ok: true },
    {
      headers: {
        "cache-control": "no-store",
        ...desktopCorsHeaders(origin),
      },
    },
  );
}

export function GET(request: Request) {
  return respond(request.headers.get("origin"));
}

export function HEAD(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      ...desktopCorsHeaders(request.headers.get("origin")),
    },
  });
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: desktopCorsHeaders(request.headers.get("origin")),
  });
}
