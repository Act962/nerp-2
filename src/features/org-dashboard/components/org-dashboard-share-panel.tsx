"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWidgetCatalog } from "@/features/dashboard-widgets/hooks/use-widget-catalog";
import { Copy, ExternalLink, Loader2, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useRotateOrgShareToken,
  useUpdateOrgPublicSettings,
} from "../hooks/use-org-dashboard";

// Compartilhamento público. Um único painel com o link atual (se ligado),
// nome público, e o Set de widgets liberados publicamente. Sem tabs — a
// experiência é linear (liga → escolhe nome → escolhe widgets → copia link).

interface WidgetRow {
  id: string;
  title: string | null;
  dataSourceKey: string;
  parentId: string | null;
}

export function OrgDashboardSharePanel({
  shareToken,
  publicName,
  publicVisibleWidgetIds,
  widgets,
}: {
  shareToken: string | null;
  publicName: string | null;
  publicVisibleWidgetIds: string[];
  widgets: WidgetRow[];
}) {
  const rotate = useRotateOrgShareToken();
  const updateSettings = useUpdateOrgPublicSettings();
  const { data: catalog } = useWidgetCatalog();
  const labelByKey = useMemo(
    () =>
      new Map(
        (catalog?.widgets ?? []).map((entry) => [entry.key, entry.label]),
      ),
    [catalog],
  );

  const [name, setName] = useState(publicName ?? "");
  const [visible, setVisible] = useState(new Set(publicVisibleWidgetIds));
  const [origin, setOrigin] = useState("");

  // Sincroniza estado local quando os dados do servidor mudam (rotate, save).
  useEffect(() => {
    setName(publicName ?? "");
    setVisible(new Set(publicVisibleWidgetIds));
  }, [publicName, publicVisibleWidgetIds]);
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = shareToken ? `${origin}/publico/dashboard/${shareToken}` : "";
  const topWidgets = widgets.filter((widget) => !widget.parentId);

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const toggleWidget = (widgetId: string) => {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(widgetId)) next.delete(widgetId);
      else next.add(widgetId);
      return next;
    });
  };

  const isDirty =
    name !== (publicName ?? "") ||
    visible.size !== publicVisibleWidgetIds.length ||
    [...visible].some((id) => !publicVisibleWidgetIds.includes(id));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Compartilhamento público</CardTitle>
          <CardDescription>
            Um link de leitura para colocar num telão, mandar para investidor,
            ou embutir num site. Não pede login. Rotacionar o link revoga todos
            os anteriores.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {shareToken ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={url}
                readOnly
                className="flex-1 font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyUrl}
              >
                <Copy className="size-4" />
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={rotate.isPending}
                onClick={() => rotate.mutate({ enable: true })}
              >
                {rotate.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCw className="size-4" />
                )}{" "}
                Rotacionar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={rotate.isPending}
                onClick={() => rotate.mutate({ enable: false })}
              >
                <Trash2 className="size-4" /> Desligar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              className="w-fit"
              disabled={rotate.isPending}
              onClick={() => rotate.mutate({ enable: true })}
            >
              {rotate.isPending && <Loader2 className="size-4 animate-spin" />}
              Ligar compartilhamento público
            </Button>
          )}
        </CardContent>
      </Card>

      {shareToken && (
        <Card>
          <CardHeader>
            <CardTitle>O que aparece no link</CardTitle>
            <CardDescription>
              Marque quais widgets ficam visíveis. Deixar tudo desmarcado deixa
              a página pública vazia (com aviso).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field>
              <FieldLabel>Nome público</FieldLabel>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Painel de Vendas — Distribuidora X"
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Widgets visíveis</Label>
              {topWidgets.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Adicione widgets primeiro na aba "Widgets".
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {topWidgets.map((widget) => (
                    <label
                      key={widget.id}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={visible.has(widget.id)}
                        onChange={() => toggleWidget(widget.id)}
                      />
                      <span>
                        {widget.title ??
                          labelByKey.get(widget.dataSourceKey) ??
                          widget.dataSourceKey}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              className="w-fit"
              disabled={!isDirty || updateSettings.isPending}
              onClick={() =>
                updateSettings.mutate({
                  publicName: name.trim() || null,
                  publicVisibleWidgetIds: [...visible],
                })
              }
            >
              {updateSettings.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
