"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";

// Alterna a tela cheia do navegador (Fullscreen API). Fica ao lado do tema.
export function FullscreenToggle({ className }: { className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className={cn(className)}
      title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
    >
      {isFullscreen ? (
        <Minimize className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Maximize className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Tela cheia</span>
    </Button>
  );
}
