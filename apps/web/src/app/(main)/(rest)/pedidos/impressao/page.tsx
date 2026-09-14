import { toReceiptOrg } from "@/features/receipt-designer/lib/org-receipt";
import { PrintStation } from "@/features/impressao-termica/components/print-station";
import { currentOrganization, requirePermission } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export const metadata = {
  title: "Estação de impressão",
};

export default async function Page() {
  await requirePermission("pedidos");

  const org = await currentOrganization();
  const dados = org
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
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Estação de impressão</h1>
        <p className="text-muted-foreground">
          Conecte a impressora uma vez e deixe esta tela aberta: todo pedido
          aceito sai sozinho no papel.
        </p>
      </div>

      <PrintStation
        org={toReceiptOrg({ ...dados, name: org?.name, logo: org?.logo })}
      />
    </div>
  );
}
