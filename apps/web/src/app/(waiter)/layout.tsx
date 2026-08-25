// Layout do app do garçom: mobile-first, fundo claro, sem sidebar/header
// do dashboard. É público (autenticação via orgSlug + escolha de colaborador,
// mesmo modelo do painel TV).
export default function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {children}
    </div>
  );
}
