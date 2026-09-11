import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateFormOrg } from "@/features/organization/components/create-form-org";
import { requireAuth } from "@/lib/auth-utils";

export default async function Page() {
  const session = await requireAuth();
  // Conta de teste tem uma organização só, e ela já existe: a segunda é
  // barrada pelo `organizationLimit` — melhor nem mostrar o formulário.
  if ((session.user as { isAnonymous?: boolean }).isAnonymous) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="#"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          TradeGram
        </Link>
        <CreateFormOrg />
      </div>
    </div>
  );
}
