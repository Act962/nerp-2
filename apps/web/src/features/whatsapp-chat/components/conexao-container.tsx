"use client";

import { Loader2, Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateFunnel, useFunnels } from "@/features/crm/hooks/use-funnels";
import { ConexaoPanel } from "./conexao-panel";

/**
 * Escolhe o funil e mostra a conexão dele.
 *
 * O funil selecionado vive na URL (`?funil=`) e não em estado local: assim o
 * operador pode mandar o link da tela já no funil certo, e um F5 não perde o
 * contexto.
 */
export function ConexaoContainer() {
  const { data, isPending } = useFunnels();
  const criar = useCreateFunnel();
  const [funnelId, setFunnelId] = useQueryState("funil");
  const [nome, setNome] = useState("");
  const [aberto, setAberto] = useState(false);

  const funis = data?.funis ?? [];

  // Sem funil na URL, assume o primeiro — a tela nunca abre vazia por acaso.
  useEffect(() => {
    if (!funnelId && funis.length > 0) {
      setFunnelId(funis[0]?.id ?? null);
    }
  }, [funnelId, funis, setFunnelId]);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando funis…
      </div>
    );
  }

  const criarFunil = async () => {
    const criado = await criar.mutateAsync({ name: nome });
    setNome("");
    setAberto(false);
    setFunnelId(criado.id);
  };

  const dialogoCriar = (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant={funis.length === 0 ? "default" : "outline"}>
          <Plus className="size-4" />
          Novo funil
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo funil de atendimento</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="nome-funil">Nome</FieldLabel>
          <Input
            id="nome-funil"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Vendas"
          />
        </Field>
        <DialogFooter>
          <Button
            onClick={criarFunil}
            disabled={criar.isPending || nome.trim().length === 0}
          >
            {criar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (funis.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-10 text-center">
        <div className="space-y-1">
          <p className="font-medium">Nenhum funil ainda</p>
          <p className="max-w-md text-muted-foreground text-sm">
            O número de WhatsApp se conecta a um funil — é ele que recebe as
            conversas e organiza os clientes em etapas. Crie o primeiro para
            continuar.
          </p>
        </div>
        {dialogoCriar}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-full max-w-xs">
          <FieldLabel htmlFor="funil">Funil</FieldLabel>
          <Select
            value={funnelId ?? undefined}
            onValueChange={(valor) => setFunnelId(valor)}
          >
            <SelectTrigger id="funil">
              <SelectValue placeholder="Selecione o funil" />
            </SelectTrigger>
            <SelectContent>
              {funis.map((funil) => (
                <SelectItem key={funil.id} value={funil.id}>
                  {funil.name}
                  {funil.whatsapp?.status === "CONNECTED" ? " · conectado" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {dialogoCriar}
      </div>

      {funnelId ? <ConexaoPanel funnelId={funnelId} /> : null}
    </div>
  );
}
