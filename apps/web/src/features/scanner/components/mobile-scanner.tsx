"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BarcodeScanner } from "@/features/shopper/components/barcode-scanner";
import { CheckCircle2, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useClaimScannerPairing,
  usePushScannerScan,
} from "../hooks/use-scanner";
import {
  ehLeituraRepetida,
  NENHUMA_LEITURA,
  type UltimaLeitura,
} from "../lib/scan-dedupe";

export function MobileScanner({ token }: { token: string }) {
  const claim = useClaimScannerPairing();
  const push = usePushScannerScan();
  const [pareado, setPareado] = useState<boolean | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  // Só o último código e QUANTOS foram. A lista completa não cabe mais na tela
  // (a câmera ocupa a altura), e um `slice(0, 8)` sobre ela deixaria o
  // contador travado em 8 — número errado no lugar de nenhum.
  const [ultimoEnviado, setUltimoEnviado] = useState<string | null>(null);
  const [totalEnviados, setTotalEnviados] = useState(0);

  const ultimoRef = useRef<UltimaLeitura>(NENHUMA_LEITURA);
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
    if (ehLeituraRepetida(ultimoRef.current, code, agora)) return;
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
          setUltimoEnviado(code);
          setTotalEnviados((prev) => prev + 1);
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

  // `h-dvh` (não `min-h-dvh`): a câmera só pode esticar dentro de uma altura
  // FECHADA. Tudo que não é vídeo encolheu para uma linha em cima e uma
  // embaixo — antes eram cabeçalho de duas linhas, lista de até 8 códigos e um
  // botão de largura inteira espremendo o quadrado da câmera no meio.
  return (
    <div className="flex h-dvh flex-col gap-2 overflow-hidden p-3">
      <div className="flex shrink-0 items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        <p className="text-sm font-medium">Leitor conectado</p>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          // Recuperação: a câmera segue lendo sozinha, isto é só para o caso
          // de o navegador travar o vídeo.
          onClick={() => window.location.reload()}
        >
          <RotateCcw className="size-4" />
          Reiniciar
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <BarcodeScanner onDetect={enviar} continuous fill />
      </div>

      {/* O histórico virou UMA linha: no balcão só importa "entrou?" e quantos
          já foram. A lista inteira custava altura de câmera, que é o que o
          operador realmente usa. */}
      <div className="flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm">
        {ultimoEnviado ? (
          <>
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span className="truncate font-mono">{ultimoEnviado}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {totalEnviados} {totalEnviados === 1 ? "item" : "itens"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            Aponte para o código de barras do produto
          </span>
        )}
      </div>
    </div>
  );
}
