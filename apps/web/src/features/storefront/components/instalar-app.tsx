"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Evento do Chrome/Android que permite abrir o "Instalar app" por um botão nosso.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Espera antes do convite: quem acabou de chegar está olhando os produtos. */
const ATRASO_MS = 4000;

function chaveDoConvite(subdomain: string) {
  return `vitrine:instalar-app:${subdomain}`;
}

function jaDispensou(subdomain: string): boolean {
  try {
    return localStorage.getItem(chaveDoConvite(subdomain)) === "1";
  } catch {
    return false;
  }
}

function lembrarDispensa(subdomain: string) {
  try {
    localStorage.setItem(chaveDoConvite(subdomain), "1");
  } catch {
    // Sem armazenamento (aba anônima): o convite volta na próxima visita, sem problema.
  }
}

/**
 * Convite para instalar a vitrine como app: instalada, ela abre em tela cheia,
 * sem a barra do navegador. Só no celular, uma vez por loja. No Android o botão
 * abre o instalador do Chrome; no iPhone não existe esse atalho, então o
 * convite ensina o caminho pelo Compartilhar.
 */
export function InstalarApp({
  subdomain,
  loja,
  logo,
}: {
  subdomain: string;
  loja: string;
  logo: string | null;
}) {
  const [pedidoDeInstalacao, setPedidoDeInstalacao] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIphone, setIsIphone] = useState(false);
  const [isVisivel, setIsVisivel] = useState(false);

  useEffect(() => {
    const isCelular = window.matchMedia("(max-width: 639px)").matches;
    const isInstalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isCelular || isInstalado || jaDispensou(subdomain)) return;

    const ehIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIphone(ehIphone);

    function aoPoderInstalar(event: Event) {
      event.preventDefault();
      setPedidoDeInstalacao(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    const relogio = window.setTimeout(() => setIsVisivel(true), ATRASO_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.clearTimeout(relogio);
    };
  }, [subdomain]);

  // Android sem o evento (navegador que não instala) não tem o que oferecer.
  if (!isVisivel || (!isIphone && !pedidoDeInstalacao)) return null;

  function dispensar() {
    lembrarDispensa(subdomain);
    setIsVisivel(false);
  }

  async function instalar() {
    if (!pedidoDeInstalacao) return;
    await pedidoDeInstalacao.prompt();
    await pedidoDeInstalacao.userChoice;
    dispensar();
  }

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 flex items-center gap-3 rounded-2xl border bg-card p-3 text-card-foreground shadow-lg sm:hidden">
      {logo ? (
        // biome-ignore lint/performance/noImgElement: logo externa da loja, tamanho fixo.
        <img src={logo} alt="" className="size-10 shrink-0 rounded-xl object-contain" />
      ) : (
        <Download className="size-6 shrink-0" style={{ color: "var(--primary)" }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">Instalar o app da {loja}</p>
        <p className="text-muted-foreground text-xs">
          {isIphone ? (
            <>
              Toque em <Share className="inline size-3.5 align-text-bottom" /> e
              depois em &quot;Adicionar à Tela de Início&quot;.
            </>
          ) : (
            "Abre em tela cheia, direto do seu celular."
          )}
        </p>
      </div>
      {!isIphone && (
        <Button size="sm" onClick={instalar}>
          Instalar
        </Button>
      )}
      <button
        type="button"
        aria-label="Agora não"
        className="shrink-0 text-muted-foreground"
        onClick={dispensar}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
