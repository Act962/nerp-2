import Image from "next/image";

// Layout mínimo do painel da TV, fora do chrome de (main): sem sidebar/header
// do dashboard, em tela cheia e fundo escuro para leitura à distância.
export default function KitchenDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {children}
      <Image
        src="/logo-dark.png"
        alt="Logo"
        width={120}
        height={40}
        priority
        className="pointer-events-none fixed bottom-4 right-4 z-50 h-auto w-24 opacity-80 sm:w-32"
      />
    </div>
  );
}
