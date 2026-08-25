"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CheckIcon, CopyIcon, Link2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useUpdateTradeCatalog } from "../hooks/use-trade-catalog-doc";

interface ShareLinkButtonProps {
  catalogId: string;
  shareToken: string;
  isPublic: boolean;
}

export function ShareLinkButton({
  catalogId,
  shareToken,
  isPublic,
}: ShareLinkButtonProps) {
  const updateCatalog = useUpdateTradeCatalog();
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/catalogo-pdv/${shareToken}`
      : `/catalogo-pdv/${shareToken}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <Link2Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex items-center gap-2">
        <Switch
          checked={isPublic}
          onCheckedChange={(checked) =>
            updateCatalog.mutate({ id: catalogId, isPublic: checked })
          }
        />
        <span className="text-sm">
          {isPublic ? "Link público ativo" : "Ativar link público"}
        </span>
      </div>
      {isPublic && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-2"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          Copiar link
        </Button>
      )}
    </div>
  );
}
