import { CatalogEditor } from "@/features/promotional-catalog/catalog-editor";

export default async function Page({
  params,
}: {
  params: Promise<{ catalogId: string }>;
}) {
  const { catalogId } = await params;
  return <CatalogEditor catalogId={catalogId} />;
}
