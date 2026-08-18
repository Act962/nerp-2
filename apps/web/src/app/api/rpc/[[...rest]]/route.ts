import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { router } from "@/app/router";
import { verifyNasaS2S } from "@/lib/nasa-s2s-verify";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

async function handleRequest(request: Request) {
  let s2s: Awaited<ReturnType<typeof verifyNasaS2S>> = null;
  try {
    s2s = await verifyNasaS2S(request);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

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
    },
  });

  return response ?? new Response("Not found", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
