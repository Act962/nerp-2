import { PageHeader } from "@/components/page-header";
import { ReceiptDesigner } from "@/features/receipt-designer/components/receipt-designer";
import { toReceiptOrg } from "@/features/receipt-designer/lib/org-receipt";
import { currentOrganization, requirePermission } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function Page() {
  await requirePermission("cupom-designer");

  // O preview usa a identidade real da org (logo, razão social, CNPJ) com uma
  // venda fictícia: é o que o operador vai ver sair na bobina.
  const org = await currentOrganization();
  const settings = org
    ? await prisma.organization.findUnique({
        where: { id: org.id },
        select: {
          tradeName: true,
          document: true,
          address: true,
          addressNumber: true,
          phone: true,
        },
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor de cupom"
        description="Modelos de cupom para impressão (80mm, 58mm, A4)"
      />
      <ReceiptDesigner
        org={toReceiptOrg({ ...settings, name: org?.name, logo: org?.logo })}
      />
    </div>
  );
}
