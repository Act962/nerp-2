import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPusherServer, isRealtimeConfigured } from "@/lib/pusher";
import { authorizeChannel } from "@/lib/realtime/channel-authorizers";

/**
 * Autoriza a assinatura de um canal privado do Pusher.
 *
 * A regra é **negar por padrão**: só passa canal que algum `ChannelAuthorizer`
 * registrado em `lib/realtime/channel-authorizers.ts` reconheça e aprove.
 * Canal desconhecido é 403, não "deixa passar porque é novo" — é justamente
 * essa validação que impede um usuário logado de assinar o canal de uma
 * conversa de outra organização e ler o atendimento alheio.
 *
 * Não há canal de presença: nada aqui precisa saber quem mais está na tela.
 */
export async function POST(req: NextRequest) {
  if (!isRealtimeConfigured()) {
    return new NextResponse("Realtime desabilitado", { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = new URLSearchParams(await req.text());
  const socketId = params.get("socket_id");
  const channel = params.get("channel_name");
  if (!socketId || !channel) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const permitido = await authorizeChannel(channel, userId);
    if (permitido !== true) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    return NextResponse.json(
      getPusherServer().authorizeChannel(socketId, channel),
    );
  } catch (error) {
    console.error("[pusher-auth] falha ao autorizar canal", error);
    return new NextResponse("Forbidden", { status: 403 });
  }
}
