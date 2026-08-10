import { ImageImportContainer } from "@/features/products-image-import/components/image-import-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function ImportarImagensPage() {
  await requirePermission("produtos");
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <ImageImportContainer />
    </div>
  );
}
