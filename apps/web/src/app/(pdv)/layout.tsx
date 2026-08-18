// Layout do consultor em campo, fora do chrome de (main): sem sidebar, sem
// header e sem breadcrumb — a tela inteira é o mapa.
export default function PdvLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden bg-background">{children}</div>;
}
