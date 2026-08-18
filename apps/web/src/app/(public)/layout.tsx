// Layout de páginas públicas/deslogadas (ex: painel de TV do ranking): sem
// sidebar/header do dashboard. É público — autenticação via slug da org na URL.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">{children}</div>
  );
}
