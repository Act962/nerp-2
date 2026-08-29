"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BarcodeScanner } from "@/features/shopper/components/barcode-scanner";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useClaimScannerPairing,
  usePushScannerScan,
} from "../hooks/use-scanner";

/**
 * Ignora releitura do MESMO código dentro desta janela.
 *
 * Em modo contínuo a câmera enxerga o mesmo item a cada ~350ms enquanto
 * apontada para ele — sem isto, parar em cima de um produto lançaria três
 * unidades por segundo. A janela cobre a rajada e ainda deixa o operador
 * bipar dois itens iguais em seguida: basta afastar e voltar, que é o gesto
 * natural e leva mais que isso.
 */
const DEDUPE_MS = 900;

export function MobileScanner({ token }: { token: string }) {
  const claim = useClaimScannerPairing();
  const push = usePushScannerScan();
  const [pareado, setPareado] = useState<boolean | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<string[]>([]);

  const ultimoRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const claimedRef = useRef(false);

  useEffect(() => {
    // Uma vez só: o token é de uso único e uma segunda tentativa se recusaria
    // a si mesma.
    if (claimedRef.current) return;
    claimedRef.current = true;
    claim.mutate(
      { token },
      {
        onSuccess: (result) => {
          setPareado(result.ok);
          setMotivo(result.reason ?? null);
        },
        onError: () => {
          setPareado(false);
          setMotivo("Não consegui falar com o servidor");
        },
      },
    );
  }, [token, claim]);

  const enviar = (code: string) => {
    const agora = Date.now();
    const ultimo = ultimoRef.current;
    if (ultimo.code === code && agora - ultimo.at < DEDUPE_MS) return;
    ultimoRef.current = { code, at: agora };

    push.mutate(
      { token, code },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setPareado(false);
            setMotivo(result.reason ?? "Leitor desconectado");
            return;
          }
          setEnviados((prev) => [code, ...prev].slice(0, 8));
          // Confirmação tátil: no balcão ninguém olha a tela do celular.
          navigator.vibrate?.(60);
        },
      },
    );
  };

  if (pareado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!pareado) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-8 text-destructive" />
        <p className="font-medium">{motivo ?? "QR inválido"}</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Gere um código novo no PDV e aponte a câmera de novo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <div className="text-center">
        <p className="font-semibold">Leitor conectado</p>
        <p className="text-sm text-muted-foreground">
          Aponte para o código de barras do produto
        </p>
      </div>

      <BarcodeScanner onDetect={enviar} continuous />

      {enviados.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Enviados ({enviados.length})
          </p>
          {enviados.map((code, index) => (
            <div
              key={`${code}-${index}`}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              {code}
            </div>
          ))}
        </div>
      )}

      {/* Recuperação: a câmera segue lendo sozinha, isto é só para o caso de
          o navegador travar o vídeo. */}
      <Button
        variant="outline"
        className="mt-auto"
        onClick={() => window.location.reload()}
      >
        Reiniciar câmera
      </Button>
    </div>
  );
}
