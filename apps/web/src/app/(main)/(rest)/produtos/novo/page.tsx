import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CreateProductForm } from "./create-product-form";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Produto"
        description="Adicione um novo produto ao seu catálogo"
      >
        <Button variant="outline" asChild>
          <Link href="/produtos">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </PageHeader>{" "}
      <CreateProductForm />
    </div>
  );
}
