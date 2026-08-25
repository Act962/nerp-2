import { RegisterFormCatalog } from "../../../../features/storefront/components/register-form";

interface RegisterParams {
  params?: Promise<{ subdomain: string }>;
}
export default async function Page({ params }: RegisterParams) {
  const subdomainValue = await params;
  return <RegisterFormCatalog subdomain={subdomainValue?.subdomain} />;
}
