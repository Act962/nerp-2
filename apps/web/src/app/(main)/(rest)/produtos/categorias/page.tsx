import { PageHeader } from "@/components/page-header";
import { ListCategories } from "@/features/products/components/list-categories";
import { CreateCategoryButton } from "./create-category-button";

export default async function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        description="Organize seus produtos em categorias"
      >
        <CreateCategoryButton />
      </PageHeader>
      <ListCategories />
    </div>
  );
}
