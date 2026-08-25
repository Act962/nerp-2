import { AccountPage } from "@/features/storefront/components/acconut";

interface AccountPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function Page({ params }: AccountPageProps) {
  const { subdomain } = await params;
  return (
    <main className="max-w-3xl mx-auto w-full px-6">
      <AccountPage subdomain={subdomain} />
    </main>
  );
}
