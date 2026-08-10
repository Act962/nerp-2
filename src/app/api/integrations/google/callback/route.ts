import { getApiSession } from "@/lib/api-auth";
import { encryptAppSecret } from "@/lib/crypto/app-secret";
import prisma from "@/lib/db";
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
} from "@/lib/google/drive";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { NextResponse } from "next/server";

// Callback do OAuth do Google. Confere o `state` no cookie, troca o `code`
// por tokens, salva a conexão CIFRANDO o refreshToken e redireciona pra
// /integracoes com um marcador de sucesso/erro.
export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session?.user) return htmlResult("error", "Sessão expirou");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return htmlResult("error", `Google devolveu: ${error}`);
  if (!code || !state) return htmlResult("error", "Callback sem code/state");

  // CSRF: state do query tem que bater com o cookie.
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("g_drive_oauth_state="))
    ?.split("=")[1];
  if (!cookieState || cookieState !== state)
    return htmlResult("error", "State inválido (CSRF ou cookie expirado)");

  // Precisamos da org ativa pra amarrar a conexão.
  const org = await auth.api.getFullOrganization({
    headers: await nextHeaders(),
  });
  if (!org) return htmlResult("error", "Nenhuma organização ativa");

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Sem refresh_token, não conseguimos renovar depois. O `prompt=consent`
      // no authorize deveria garantir isso — mas se o Google reciclar um
      // consentimento antigo, pode voltar sem. Falha claro.
      return htmlResult(
        "error",
        "Google não devolveu refresh_token. Revogue o acesso no https://myaccount.google.com/permissions e tente conectar de novo.",
      );
    }

    const userInfo = await fetchGoogleUserInfo(tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    // Upsert por (org, user): reconectar substitui a linha anterior.
    await prisma.googleDriveConnection.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: session.user.id,
        },
      },
      create: {
        organizationId: org.id,
        userId: session.user.id,
        googleEmail: userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: encryptAppSecret(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope,
      },
      update: {
        googleEmail: userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: encryptAppSecret(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope,
      },
    });

    const response = htmlResult("success", `Conectado como ${userInfo.email}`);
    // Limpa o cookie do state (uso único).
    response.cookies.set("g_drive_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    return htmlResult(
      "error",
      err instanceof Error ? err.message : "Falha na integração",
    );
  }
}

// Redireciona pra /integracoes com query `?drive=success|error&msg=...`.
function htmlResult(kind: "success" | "error", msg: string): NextResponse {
  const params = new URLSearchParams({ drive: kind, msg });
  return NextResponse.redirect(
    new URL(`/integracoes?${params.toString()}`, envBase()),
  );
}

function envBase(): string {
  // Prefere BETTER_AUTH_URL (padrão do stack). Fallback pra origin do request
  // via NextRequest... aqui só uso a env pra manter o redirect absoluto.
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}
