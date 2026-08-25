import { LoginFormCatalog } from "../../../../features/storefront/components/login-form";

interface LoginParams {
  params?: Promise<{ subdomain: string }>;
}
export default async function Page({ params }: LoginParams) {
  const subdomainValue = await params;
  return <LoginFormCatalog subdomain={subdomainValue?.subdomain} />;
}
