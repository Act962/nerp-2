import CreateSalePage from "@/features/sales/components/novo/create-sale";
import { toReceiptOrg } from "@/features/receipt-designer/lib/org-receipt";
import { currentOrganization } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function Page() {
  const org = await currentOrganization();
  const settings = org
    ? await prisma.organization.findUnique({
        where: { id: org.id },
        select: {
          requireCancelAuth: true,
          tradeName: true,
          document: true,
          address: true,
          addressNumber: true,
          phone: true,
        },
      })
    : null;

  return (
    <CreateSalePage
      orgLogo={org?.logo ?? null}
      orgName={org?.name ?? null}
      receiptOrg={toReceiptOrg({
        ...settings,
        name: org?.name,
        logo: org?.logo,
      })}
      requireCancelAuth={settings?.requireCancelAuth ?? false}
    />
  );
}
