"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  ArrowDown,
  ArrowUp,
  ImageOff,
  Loader2,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import {
  useDeletePdvMedia,
  usePdvMediaList,
  useReorderPdvMedia,
  useUpdatePdvMedia,
  useUpdatePdvMediaSettings,
} from "../hooks/use-pdv-media";
import { PdvMediaFormDialog } from "./pdv-media-form-dialog";

export function PdvMediaContainer() {
  const { medias, settings, isLoading } = usePdvMediaList();
  const updateSettings = useUpdatePdvMediaSettings();
  const update = useUpdatePdvMedia();
  const remove = useDeletePdvMedia();
  const reorder = useReorderPdvMedia();
  const [addOpen, setAddOpen] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= medias.length) return;
    const ids = medias.map((m) => m.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ ids });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mídia do PDV</h1>
          <p className="text-sm text-muted-foreground">
            Imagens e vídeos que passam na coluna esquerda da tela de venda.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 size-4" />
          Adicionar mídia
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exibição</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pdv-media-enabled">Exibir mídia no PDV</Label>
              <p className="text-sm text-muted-foreground">
                Liga ou desliga o painel de mídia na frente de caixa.
              </p>
            </div>
            <Switch
              id="pdv-media-enabled"
              checked={settings.enabled}
              onCheckedChange={(enabled) => updateSettings.mutate({ enabled })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pdv-media-pause">
                Pausa entre mídias (segundos)
              </Label>
              <p className="text-sm text-muted-foreground">
                Intervalo aplicado ao trocar de uma mídia para a próxima.
              </p>
            </div>
            <Input
              id="pdv-media-pause"
              type="number"
              min={0}
              max={60}
              className="w-24"
              defaultValue={settings.pauseSeconds}
              onBlur={(e) => {
                const pauseSeconds = Math.min(
                  60,
                  Math.max(0, Number(e.target.value) || 0),
                );
                if (pauseSeconds !== settings.pauseSeconds)
                  updateSettings.mutate({ pauseSeconds });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Mídias {medias.length > 0 && `(${medias.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : medias.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <ImageOff className="size-8" />
              <p className="text-sm">
                Nenhuma mídia ainda. Adicione a primeira para começar.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y">
              {medias.map((media, index) => (
                <li key={media.id} className="flex items-center gap-3 py-3">
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded border bg-muted">
                    {media.type === "VIDEO" ? (
                      // biome-ignore lint/a11y/useMediaCaption: mídia promocional muda
                      <video
                        src={constructUrl(media.url)}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={constructUrl(media.url)}
                        alt={media.title ?? "Mídia"}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {media.title || `Mídia ${index + 1}`}
                      </span>
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        {media.type === "VIDEO" ? (
                          <>
                            <Video className="size-3" /> Vídeo
                          </>
                        ) : (
                          "Imagem"
                        )}
                      </Badge>
                      {!media.isActive && (
                        <Badge variant="outline" className="shrink-0">
                          Inativa
                        </Badge>
                      )}
                    </div>
                    {media.type === "IMAGE" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Tempo:</span>
                        <Input
                          type="number"
                          min={1}
                          max={600}
                          className="h-7 w-20"
                          defaultValue={media.durationSeconds}
                          onBlur={(e) => {
                            const durationSeconds = Math.max(
                              1,
                              Number(e.target.value) || 1,
                            );
                            if (durationSeconds !== media.durationSeconds)
                              update.mutate({ id: media.id, durationSeconds });
                          }}
                        />
                        <span>s</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Toca até o fim
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Switch
                      checked={media.isActive}
                      onCheckedChange={(isActive) =>
                        update.mutate({ id: media.id, isActive })
                      }
                      aria-label="Ativa"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={
                        index === medias.length - 1 || reorder.isPending
                      }
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => remove.mutate({ id: media.id })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PdvMediaFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
