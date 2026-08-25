import CreateSalePage from "@/features/sales/components/novo/create-sale";
import { currentOrganization } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function Page() {
  const org = await currentOrganization();
  const settings = org
    ? await prisma.organization.findUnique({
        where: { id: org.id },
        select: { requireCancelAuth: true },
      })
    : null;

  return (
    <CreateSalePage
      orgLogo={org?.logo ?? null}
      orgName={org?.name ?? null}
      requireCancelAuth={settings?.requireCancelAuth ?? false}
    />
  );
}
