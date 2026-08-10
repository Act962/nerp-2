import { PdvMediaContainer } from "@/features/pdv-media/components/pdv-media-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function PdvMediaPage() {
  await requirePermission("midia-pdv");
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <PdvMediaContainer />
    </div>
  );
}
