import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { TemplateEditor } from "@/features/books/components/template-editor";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTradeAccess("books");
  const { id } = await params;
  return <TemplateEditor templateId={id} />;
}
