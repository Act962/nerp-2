"use client";

import { Monitor, RotateCcw, Smartphone, Tablet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SiteSectionKey } from "../lib/section";
import { siteUrl } from "../lib/section";

/**
 * Espelho ao vivo do site, ao lado do editor.
 *
 * O `apps/site` é outro app — outro domínio, outro build — então isto é um
 * IFRAME, não uma renderização compartilhada. E o iframe carrega a versão
 * PUBLICADA: rascunho vivo exigiria uma rota de preview no `apps/site` e um
 * token para atravessar o CORS, e o custo não paga o ganho enquanto o botão
 * "Salvar e publicar" é uma tecla. Toda vez que a pessoa publica, o iframe
 * recarrega sozinho.
 *
 * Só aparece a partir de `2xl` (a partir de ~1536px). O editor já ocupa duas
 * colunas em telas médias; abrir uma terceira em tudo espremeria os campos.
 * Abaixo desse tamanho segue valendo o botão "Pré-visualizar" do cabeçalho.
 */
type Dispositivo = "mobile" | "tablet" | "desktop";

const TAMANHOS: Record<Dispositivo, { largura: number; altura: string }> = {
  mobile: { largura: 375, altura: "812px" },
  tablet: { largura: 768, altura: "1024px" },
  desktop: { largura: 1280, altura: "820px" },
};

export function SitePagePreview({
  section,
  slug,
  /**
   * Muda a cada publicação bem-sucedida no editor. O iframe usa como key para
   * remontar e o novo build ser puxado — recarregar `src` sem trocar de key
   * às vezes retorna do cache do navegador.
   */
  publishedAt,
  /**
   * Id do bloco em foco no editor. Sempre que muda, o admin manda um
   * `postMessage` para o iframe e o site rola até lá com scroll suave.
   */
  selectedBlockId,
}: {
  section: SiteSectionKey;
  slug: string;
  publishedAt?: number;
  selectedBlockId?: string;
}) {
  const url = siteUrl(section, slug);
  const [dispositivo, setDispositivo] = useState<Dispositivo>("mobile");
  const [nonce, setNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // O iframe leva um instante para estar pronto. Marcamos a cada `load` e
  // esse `tick` reexecuta o efeito de envio — assim a rolagem funciona no
  // primeiro render e depois de cada troca de aparelho ou publicação.
  const [loadTick, setLoadTick] = useState(0);

  // Publicou → recarrega. Nada acontece na primeira renderização (nonce
  // continua 0), então a página nasce direto no build publicado.
  useEffect(() => {
    if (publishedAt) setNonce((n) => n + 1);
  }, [publishedAt]);

  // Bloco selecionado no editor → o iframe rola até ele.
  //
  // Escutar `loadTick` faz a mensagem ser reenviada assim que o site termina
  // de carregar depois de um recarregamento (publicar, trocar de aparelho,
  // primeira montagem) — sem isto o postMessage bate antes do listener existir
  // do outro lado e some. `targetOrigin` casa com a URL para a mensagem não
  // vazar se o iframe for redirecionado.
  useEffect(() => {
    if (!selectedBlockId) return;
    const janela = iframeRef.current?.contentWindow;
    if (!janela) return;
    try {
      janela.postMessage(
        { type: "site:scrollToBlock", blockId: selectedBlockId },
        new URL(url).origin,
      );
    } catch {
      // Iframe cross-origin sem contexto pronto — o próximo `load` reexecuta.
    }
    // Toque no `loadTick` para o efeito reexecutar a cada carga do iframe.
    void loadTick;
  }, [selectedBlockId, loadTick, url]);

  const tamanho = TAMANHOS[dispositivo];

  return (
    <aside className="hidden 2xl:sticky 2xl:top-4 2xl:flex 2xl:h-[calc(100vh-2rem)] 2xl:w-[520px] 2xl:flex-col 2xl:gap-3 2xl:rounded-lg 2xl:border 2xl:bg-muted/30 2xl:p-3">
      <header className="flex items-center gap-2">
        <div className="flex rounded-md border bg-background p-0.5">
          <Aparelho
            ativo={dispositivo === "mobile"}
            onClick={() => setDispositivo("mobile")}
            aria="Celular"
          >
            <Smartphone className="size-4" />
          </Aparelho>
          <Aparelho
            ativo={dispositivo === "tablet"}
            onClick={() => setDispositivo("tablet")}
            aria="Tablet"
          >
            <Tablet className="size-4" />
          </Aparelho>
          <Aparelho
            ativo={dispositivo === "desktop"}
            onClick={() => setDispositivo("desktop")}
            aria="Desktop"
          >
            <Monitor className="size-4" />
          </Aparelho>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">Publicado</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Recarregar preview"
          onClick={() => setNonce((n) => n + 1)}
        >
          <RotateCcw className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto rounded-md bg-muted/60 p-3">
        {/* O iframe fica na largura pedida pelo aparelho, e o CSS escala tudo
            se for maior que a coluna — sem isso o mobile fica ok, mas o tablet
            escapa da faixa. */}
        <div
          className="origin-top overflow-hidden rounded-md border bg-background shadow-sm"
          style={{
            width: tamanho.largura,
            maxWidth: "100%",
            transform:
              tamanho.largura > 480
                ? `scale(${(480 / tamanho.largura).toFixed(3)})`
                : undefined,
          }}
        >
          <iframe
            key={`${dispositivo}-${nonce}`}
            ref={iframeRef}
            title="Prévia do site"
            src={url}
            width={tamanho.largura}
            onLoad={() => setLoadTick((t) => t + 1)}
            style={{ height: tamanho.altura, width: "100%", border: 0 }}
            // sandbox permissivo: o iframe é um app NOSSO, no mesmo host.
            // Deixar `same-origin` OFF quebraria fontes, analytics e o próprio
            // Next/Image; deixar `scripts` OFF derrubaria a hidratação do site.
          />
        </div>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        Mostra o que está no ar — rascunho não salvo não aparece aqui. Publique
        para ver a mudança.
      </p>
    </aside>
  );
}

function Aparelho({
  ativo,
  onClick,
  aria,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  aria: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={aria}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-sm transition-colors",
        ativo
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
