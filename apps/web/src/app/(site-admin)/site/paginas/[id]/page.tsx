import { SitePageEditor } from "@/features/site/components/site-page-editor";

export default async function SitePageEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SitePageEditor pageId={id} />;
}
