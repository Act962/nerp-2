"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { cn } from "@/lib/utils";
import { hasFullAccess } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { type WeighedConfig, parseWeighedBarcode } from "../weighed-barcode";
import {
  usePdvWeighedConfig,
  useUpdatePdvWeighedConfig,
} from "../hooks/use-weighed";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? 0 : Number(event.target.value))
        }
      />
    </div>
  );
}

export function WeighedConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { config } = usePdvWeighedConfig();
  const { member } = useCurrentMember();
  const update = useUpdatePdvWeighedConfig();
  const isAdmin = hasFullAccess(member?.role);

  const [local, setLocal] = useState<WeighedConfig>(config);
  const [test, setTest] = useState("");

  useEffect(() => {
    if (open) setLocal(config);
  }, [open, config]);

  const set = <K extends keyof WeighedConfig>(
    key: K,
    value: WeighedConfig[K],
  ) => setLocal((current) => ({ ...current, [key]: value }));

  const testResult = test ? parseWeighedBarcode(test, local) : null;

  const save = () => {
    update.mutate({ config: local }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Balança — código de barras pesável</DialogTitle>
          <DialogDescription>
            EAN-13 da balança (ex.: prefixo "2") com código do produto + valor
            (peso ou preço) embutido. {isAdmin ? "" : "Só o admin edita."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="weighed-enabled">Ativar código pesável</Label>
            <Switch
              id="weighed-enabled"
              checked={local.enabled}
              disabled={!isAdmin}
              onCheckedChange={(value) => set("enabled", value)}
            />
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Valor embutido</span>
            <div className="flex gap-2">
              {(["PRICE", "WEIGHT"] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant={local.kind === kind ? "default" : "outline"}
                  size="sm"
                  disabled={!isAdmin}
                  onClick={() => set("kind", kind)}
                >
                  {kind === "PRICE" ? "Preço (R$)" : "Peso (kg)"}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1 flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Prefixo</span>
              <Input
                value={local.prefix}
                disabled={!isAdmin}
                onChange={(event) => set("prefix", event.target.value)}
              />
            </div>
            <NumberField
              label="Casas decimais"
              value={local.valueDecimals}
              onChange={(value) => set("valueDecimals", value)}
            />
            <div />
            <NumberField
              label="Código: início"
              value={local.codeStart}
              onChange={(value) => set("codeStart", value)}
            />
            <NumberField
              label="Código: tamanho"
              value={local.codeLength}
              onChange={(value) => set("codeLength", value)}
            />
            <div />
            <NumberField
              label="Valor: início"
              value={local.valueStart}
              onChange={(value) => set("valueStart", value)}
            />
            <NumberField
              label="Valor: tamanho"
              value={local.valueLength}
              onChange={(value) => set("valueLength", value)}
            />
            <div />
          </div>

          <div className="space-y-1 rounded-lg border p-3">
            <Label htmlFor="weighed-test" className="text-xs">
              Testar um código
            </Label>
            <Input
              id="weighed-test"
              placeholder="Cole/escaneie um EAN pesável"
              value={test}
              onChange={(event) => setTest(event.target.value)}
            />
            {test && (
              <p className="text-xs text-muted-foreground">
                {testResult ? (
                  <>
                    Produto <strong>{testResult.itemCode}</strong> ·{" "}
                    {testResult.kind === "PRICE"
                      ? `R$ ${(testResult.price ?? 0).toFixed(2)}`
                      : `${(testResult.weightKg ?? 0).toFixed(3)} kg`}
                  </>
                ) : (
                  <span className={cn(local.enabled && "text-destructive")}>
                    {local.enabled
                      ? "Não reconhecido com este layout."
                      : "Ative o código pesável para testar."}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {isAdmin && (
          <DialogFooter>
            <Button type="button" onClick={save} disabled={update.isPending}>
              {update.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
