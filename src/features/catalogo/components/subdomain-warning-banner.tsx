"use client";

import { AlertTriangle, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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

  if (!subdomain) return null;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
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
    <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <h4 className="text-sm font-semibold">Subdomínio indisponível</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Enquanto habilitamos o subdomínio deste ambiente, seu catálogo
          online já está no ar em:
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
        </div>
        <p className="text-xs text-muted-foreground">
          Compartilhe esse link com seus clientes. O catálogo continua
          totalmente público (sem login).
        </p>
      </CardContent>
    </Card>
  );
}
