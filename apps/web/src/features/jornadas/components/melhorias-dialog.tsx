"use client";

import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MAX_IMAGENS_POR_MELHORIA } from "../lib/limites";
import { capturarTela } from "../lib/capturar-tela";
import { subirImagem } from "../lib/subir-imagem";
import { useEnviarMelhoria } from "../hooks/use-jornadas";

const MINIMO = 10;
const MAXIMO = 2000;
const TIPOS = ["image/png", "image/jpeg", "image/webp"];

interface Anexo {
  arquivo: File;
  previa: string;
}

/**
 * "Melhorias": o caminho direto entre quem usa e quem constrói.
 *
 * O print é o ponto todo. Descrever um problema de tela em texto é difícil, e
 * é por isso que o botão "Capturar esta tela" existe: um clique, sem a pessoa
 * precisar saber tirar print, achar o arquivo e anexar.
 *
 * As imagens sobem no ENVIO, e não ao escolher: quem desiste no meio não deixa
 * lixo pago no bucket da empresa.
 */
export function MelhoriasDialog({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const pathname = usePathname();
  const enviar = useEnviarMelhoria();
  const [mensagem, setMensagem] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [capturando, setCapturando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);

  const limpar = () => {
    for (const anexo of anexos) URL.revokeObjectURL(anexo.previa);
    setAnexos([]);
    setMensagem("");
  };

  const fechar = () => {
    limpar();
    aoFechar();
  };

  const acrescentar = (arquivos: File[]) => {
    const aceitos = arquivos.filter((a) => TIPOS.includes(a.type));
    if (aceitos.length < arquivos.length) {
      toast.error("Só aceito imagem PNG, JPG ou WebP");
    }
    setAnexos((atuais) => {
      const cabe = MAX_IMAGENS_POR_MELHORIA - atuais.length;
      if (cabe <= 0) {
        toast.error(`No máximo ${MAX_IMAGENS_POR_MELHORIA} imagens`);
        return atuais;
      }
      const novos = aceitos.slice(0, cabe).map((arquivo) => ({
        arquivo,
        previa: URL.createObjectURL(arquivo),
      }));
      return [...atuais, ...novos];
    });
  };

  const remover = (indice: number) => {
    setAnexos((atuais) => {
      const alvo = atuais[indice];
      if (alvo) URL.revokeObjectURL(alvo.previa);
      return atuais.filter((_, i) => i !== indice);
    });
  };

  const capturar = async () => {
    setCapturando(true);
    const arquivo = await capturarTela();
    setCapturando(false);
    if (!arquivo) {
      toast.error(
        "Não consegui fotografar a tela. Anexe uma imagem, se quiser.",
      );
      return;
    }
    acrescentar([arquivo]);
  };

  const enviarPedido = async () => {
    setSubindo(true);
    try {
      const urls: string[] = [];
      for (const anexo of anexos) {
        const url = await subirImagem(anexo.arquivo, "melhorias");
        if (url) urls.push(url);
      }
      if (urls.length < anexos.length) {
        toast.error("Alguma imagem não subiu — vou enviar o que deu certo");
      }
      await enviar.mutateAsync({ pathname, mensagem, imagens: urls });
      limpar();
      aoFechar();
    } finally {
      setSubindo(false);
    }
  };

  const ocupado = subindo || enviar.isPending;
  const podeEnviar = mensagem.trim().length >= MINIMO && !ocupado;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent
        data-melhorias-dialog
        className="sm:max-w-lg"
        onPaste={(evento) => {
          const colados = Array.from(evento.clipboardData.files);
          if (colados.length > 0) acrescentar(colados);
        }}
      >
        <DialogHeader>
          <DialogTitle>Mandar uma melhoria</DialogTitle>
          <DialogDescription>
            O que está faltando, o que atrapalha, o que você faria diferente.
            Vai direto para a equipe da ÓRBITA — com a tela em que você está.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value.slice(0, MAXIMO))}
          placeholder="Ex.: no PDV eu queria buscar o produto pelo nome do fornecedor também."
          className="min-h-32"
          aria-label="Sua sugestão"
        />

        {anexos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {anexos.map((anexo, indice) => (
              <div
                key={anexo.previa}
                className="relative size-20 overflow-hidden rounded-md border"
              >
                {/* biome-ignore lint/performance/noImgElement: prévia local de blob, não passa pelo otimizador */}
                <img
                  src={anexo.previa}
                  alt={`Anexo ${indice + 1}`}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => remover(indice)}
                  aria-label={`Remover anexo ${indice + 1}`}
                  className="absolute top-0.5 right-0.5 rounded bg-background/90 p-0.5 hover:bg-background"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={seletor}
            type="file"
            accept={TIPOS.join(",")}
            multiple
            hidden
            onChange={(e) => {
              acrescentar(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => seletor.current?.click()}
          >
            <ImagePlus className="size-4" /> Anexar imagem
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={capturar}
            disabled={capturando}
          >
            {capturando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            Capturar esta tela
          </Button>
          <span className="text-muted-foreground text-xs">
            {anexos.length}/{MAX_IMAGENS_POR_MELHORIA} · cole uma imagem aqui
            também
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={enviarPedido} disabled={!podeEnviar}>
            {ocupado && <Loader2 className="size-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
