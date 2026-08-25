import DashboardPage from "@/features/dashboard/components/dashboard";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("dashboard");
  return <DashboardPage />;
}
