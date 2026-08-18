import { requireAuth } from "@/lib/auth-utils";
import { ApproveCancel } from "@/features/cancel-auth/components/approve-cancel";

export default async function AutorizarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await requireAuth();
  const { token } = await params;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <ApproveCancel token={token} />
    </div>
  );
}
