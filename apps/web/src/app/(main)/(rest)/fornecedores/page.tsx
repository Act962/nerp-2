import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AddSupplierModal } from "@/features/supplier/components/add-supplier";
import { ListSuppliers } from "@/features/supplier/components/list-suppliers";
import { requireViewAccess } from "@/lib/auth-utils";
import { PlusIcon, UploadIcon } from "lucide-react";
import Link from "next/link";

export default async function Page() {
  const { readOnly } = await requireViewAccess("fornecedores");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description="Gerencie seus fornecedores e contatos comerciais"
      >
        {!readOnly && (
          <>
            <Button variant="outline" asChild>
              <Link href="/fornecedores/importar">
                <UploadIcon className="size-4" />
                Importar
              </Link>
            </Button>
            <AddSupplierModal>
              <Button>
                <PlusIcon className="size-4" />
                Novo Fornecedor
              </Button>
            </AddSupplierModal>
          </>
        )}
      </PageHeader>
      <ListSuppliers readOnly={readOnly} />
    </div>
  );
}
