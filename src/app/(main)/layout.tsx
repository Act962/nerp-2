import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PdvMediaPanel } from "@/features/pdv-media/components/pdv-media-panel";
import { requireAuth, currentOrganization } from "@/lib/auth-utils";
import { ModalProvider } from "@/components/providers/modal-provider";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { AppHeader } from "@/components/app-header";
import { EmptyOrganization } from "@/components/empty-organization";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  const org = await currentOrganization();

  return (
    // h-dvh e não h-screen: no Safari/Chrome do celular a barra de endereço
    // não entra no 100vh, e o rodapé do conteúdo ficava inalcançável.
    <SidebarProvider className="flex h-dvh overflow-hidden">
      <AppSidebar />
      {/* Mídia do PDV: ocupa a coluna esquerda inteira (topo ao rodapé), no
          lugar da sidebar oculta. Fica fora do <main> pra não ficar sob o
          header. Só aparece no /vendas/novo (o próprio componente decide). */}
      <PdvMediaPanel />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          {org ? (
            // Sem `container mx-auto`: o conteúdo ocupa toda a largura
            // disponível do <main>. Quando a sidebar colapsa em modo icon,
            // o <main> ganha largura via flex-1 do SidebarProvider e o
            // conteúdo se expande junto. Páginas que precisam de largura
            // contida (forms longos) podem usar max-w-* localmente.
            <div className="w-full space-y-6 p-4 md:p-6">
              <BreadcrumbNav />
              {children}
            </div>
          ) : (
            <EmptyOrganization />
          )}
        </main>
      </div>
      <ModalProvider />
    </SidebarProvider>
  );
}
