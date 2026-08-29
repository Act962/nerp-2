import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";

/**
 * Fluxo de códigos lidos no celular, entregue ao PDV por SSE.
 *
 * SSE e não polling do cliente porque o número que importa aqui é a LATÊNCIA:
 * um leitor que demora meio segundo é pior que o leitor de balcão. O servidor
 * consulta o banco em intervalo curto (barato, sem ida e volta de rede) e
 * empurra assim que aparece.
 *
 * Cada código é marcado como consumido na entrega — o PDV não pode receber o
 * mesmo item duas vezes e lançar em dobro na venda.
 */
const POLL_MS = 250;
const HEARTBEAT_MS = 15_000;
/** Teto de vida do fluxo: sem isso, aba esquecida segura conexão para sempre. */
const MAX_LIFETIME_MS = 30 * 60_000;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("token ausente", { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("não autenticado", { status: 401 });

  const org = await auth.api.getFullOrganization({ headers: await headers() });
  if (!org) return new Response("sem organização", { status: 403 });

  // O pareamento é revalidado contra a org da sessão: token de outra empresa
  // não abre fluxo aqui.
  const pairing = await prisma.scannerPairing.findFirst({
    where: { token, organizationId: org.id },
    select: { id: true },
  });
  if (!pairing)
    return new Response("pareamento não encontrado", { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Descarta o que ficou pendente ANTES desta conexão.
      //
      // O celular continua enviando mesmo com o PDV fechado ou em outra tela.
      // Sem esta limpeza, tudo isso seria entregue de uma vez ao reconectar —
      // e itens bipados durante o atendimento anterior cairiam na venda
      // seguinte, na conta do cliente errado. O pareamento é um canal AO VIVO:
      // o que não foi consumido na hora não vale mais.
      await prisma.scannerScan.updateMany({
        where: { pairingId: pairing.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      send("ready", { ok: true });

      const startedAt = Date.now();
      let lastBeat = Date.now();

      const timer = setInterval(async () => {
        if (closed) return;
        if (Date.now() - startedAt > MAX_LIFETIME_MS) {
          send("bye", { reason: "tempo máximo do fluxo" });
          closed = true;
          clearInterval(timer);
          controller.close();
          return;
        }

        try {
          const pendentes = await prisma.scannerScan.findMany({
            where: { pairingId: pairing.id, consumedAt: null },
            orderBy: { createdAt: "asc" },
            select: { id: true, code: true },
            take: 20,
          });

          if (pendentes.length > 0) {
            await prisma.scannerScan.updateMany({
              where: { id: { in: pendentes.map((scan) => scan.id) } },
              data: { consumedAt: new Date() },
            });
            for (const scan of pendentes) send("scan", { code: scan.code });
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            // Comentário SSE: mantém proxies de pé sem virar evento na ponta.
            controller.enqueue(encoder.encode(": ping\n\n"));
            lastBeat = Date.now();
          }
        } catch {
          // Falha momentânea de banco não derruba o fluxo; a próxima volta
          // tenta de novo. Derrubar obrigaria o operador a reparear.
        }
      }, POLL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Já fechado pelo cliente.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Nginx/Coolify: sem isso o proxy pode bufferizar e matar a latência.
      "X-Accel-Buffering": "no",
    },
  });
}
