import { getApiSession } from "@/lib/api-auth";
import { buildAuthorizeUrl } from "@/lib/google/drive";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

// Inicia o fluxo OAuth: valida sessão, gera um `state` opaco (guardado num
// cookie httpOnly de curta duração) e redireciona pro Google. O callback lê
// o cookie pra confirmar que a resposta é da MESMA sessão que iniciou.
export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session?.user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const state = randomBytes(24).toString("base64url");
  const url = buildAuthorizeUrl(state);

  const response = NextResponse.redirect(url);
  // Cookie por 5min — se o usuário demorar mais que isso, o state expira.
  response.cookies.set("g_drive_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
