import { JoinLinkCard } from "./_components/join-link-card";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <JoinLinkCard token={token} />
    </div>
  );
}
