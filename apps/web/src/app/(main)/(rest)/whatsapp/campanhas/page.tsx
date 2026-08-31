import { PageHeader } from "@/components/page-header";
import { CampanhasContainer } from "@/features/campanhas/components/campanhas-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("whatsapp");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Campanhas"
        description="Disparo em massa pela API oficial, com template aprovado pela Meta."
      />
      <CampanhasContainer />
    </div>
  );
}
