import "server-only";

import prisma from "@/lib/db";
import { idDoCanal } from "./channels";
import type { ChannelAuthorizer } from "./types";

/** `userId` é membro desta organização? */
async function ehMembro(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  return Boolean(member);
}

const orgAuthorizer: ChannelAuthorizer = {
  matches: (channel) => idDoCanal(channel, "org") !== null,
  authorize: async (channel, userId) => {
    const organizationId = idDoCanal(channel, "org");
    if (!organizationId) return false;
    return ehMembro(userId, organizationId);
  },
};

/**
 * Registry dos canais privados. Canal novo entra aqui — o endpoint de auth não
 * muda.
 *
 * Os authorizers de conversa e de funil entram junto com os seus models
 * (fases 3 e 4): sem model não há como verificar de que organização o canal é,
 * e um authorizer que devolve `true` sem checar é pior que canal nenhum.
 */
const channelAuthorizers: ChannelAuthorizer[] = [orgAuthorizer];

/**
 * `true`/`false` quando algum authorizer reconhece o canal; `null` quando
 * nenhum reconhece — aí o caller decide o fallback (que é negar).
 */
export async function authorizeChannel(
  channel: string,
  userId: string,
): Promise<boolean | null> {
  const authorizer = channelAuthorizers.find((candidate) =>
    candidate.matches(channel),
  );
  if (!authorizer) return null;
  return authorizer.authorize(channel, userId);
}
