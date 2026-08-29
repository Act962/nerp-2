import { MobileScanner } from "@/features/scanner/components/mobile-scanner";

// Página aberta pelo QR do PDV. Pública de propósito: o token é a credencial,
// e é isso que evita digitar e-mail e senha no balcão a cada pareamento.
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <MobileScanner token={token} />;
}
