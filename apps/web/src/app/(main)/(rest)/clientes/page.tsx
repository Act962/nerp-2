import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AddCustomerModal } from "@/features/custom/components/add-customer";
import { ListCustomers } from "@/features/custom/components/list-customers";
import { requirePermission } from "@/lib/auth-utils";
import { PlusIcon, UploadIcon } from "lucide-react";
import Link from "next/link";

export default async function Page() {
  await requirePermission("clientes");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerencie seus clientes e acompanhe o histórico de compras"
      >
        <Button variant="outline" asChild>
          <Link href="/clientes/importar">
            <UploadIcon className="size-4" />
            Importar
          </Link>
        </Button>
        <AddCustomerModal>
          <Button>
            <PlusIcon className="size-4" />
            Novo Cliente
          </Button>
        </AddCustomerModal>
      </PageHeader>
      <ListCustomers />
    </div>
  );
}
