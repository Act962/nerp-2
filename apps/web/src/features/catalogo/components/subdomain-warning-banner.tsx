"use client";

import { Copy, Check, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Aviso mostrado na tela de configurações do catálogo enquanto o modo
// subdomínio (`{subdomain}.dominio.com`) estiver indisponível no ambiente.
// A URL alternativa é `dominio.com/catalogo/{subdomain}` — o botão copia.
export function SubdomainWarningBanner({
  subdomain,
}: {
  subdomain: string | null;
}) {
  const [copied, setCopied] = useState(false);
  // A origem só existe no navegador: lida no render, o servidor escrevia
  // "/catalogo/x" e o cliente "http://…/catalogo/x" — erro de hidratação.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!subdomain) return null;

  const catalogUrl = origin
    ? `${origin}/catalogo/${subdomain}`
    : `/catalogo/${subdomain}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(catalogUrl);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Card className="mb-4 border-blue-500/40 bg-blue-500/10">
      <CardContent className="flex flex-col gap-2 p-4">
        <p className="text-sm text-muted-foreground">
          Enquanto habilitamos o subdomínio deste ambiente, seu catálogo online
          já está no ar em:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-sm">
            {catalogUrl}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="size-3.5" /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Copiar link
              </>
            )}
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={catalogUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Abrir link em uma nova aba
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Compartilhe esse link com seus clientes. O catálogo continua
          totalmente público (sem login).
        </p>
      </CardContent>
    </Card>
  );
}
