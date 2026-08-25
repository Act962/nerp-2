import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AcceptInvitationCard } from "./_components/accept-invitation-card";

export default async function Page({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <AcceptInvitationCard
        invitationId={invitationId}
        currentUserEmail={session?.user.email ?? null}
      />
    </div>
  );
}
