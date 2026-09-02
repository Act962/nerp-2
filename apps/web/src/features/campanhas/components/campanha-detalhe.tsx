"use client";

import { AlertTriangle, Loader2, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdicionarDestinatarios,
  useCampanha,
  useDispararCampanha,
  useEscolherTemplate,
  useTemplates,
} from "../hooks/use-campanhas";

const ROTULO_DE_STATUS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  SENDING: "Disparando",
  SENT: "Enviada",
  PAUSED: "Pausada",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

export function CampanhaDetalhe({ broadcastId }: { broadcastId: string }) {
  const { data: campanha, isPending } = useCampanha(broadcastId);
  const { data: dadosDeTemplates } = useTemplates(campanha?.funnelId ?? null);
  const adicionar = useAdicionarDestinatarios();
  const escolher = useEscolherTemplate();
  const disparar = useDispararCampanha();

  if (isPending || !campanha) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando campanha…
      </div>
    );
  }

  const templates = dadosDeTemplates?.templates ?? [];
  const podeEditar =
    campanha.status === "DRAFT" || campanha.status === "SCHEDULED";
  const { contadores } = campanha;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-medium text-lg">{campanha.nome}</h2>
        <Badge variant={campanha.status === "SENT" ? "default" : "secondary"}>
          {ROTULO_DE_STATUS[campanha.status] ?? campanha.status}
        </Badge>
        {campanha.status === "SENDING" ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Numero rotulo="Destinatários" valor={contadores.total} />
        <Numero rotulo="Enviadas" valor={contadores.enviadas} />
        <Numero rotulo="Entregues" valor={contadores.entregues} />
        <Numero rotulo="Lidas" valor={contadores.lidas} />
        <Numero rotulo="Falharam" valor={contadores.falharam} destaque />
      </div>

      {podeEditar ? (
        <>
          <section className="space-y-2">
            <h3 className="font-medium text-sm">1. Quem vai receber</h3>
            <p className="text-muted-foreground text-sm">
              Traz os clientes deste funil. Quem não tem telefone fica de fora,
              e quem já está na lista não entra duas vezes.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={adicionar.isPending}
              onClick={() => adicionar.mutate({ broadcastId, limite: 1000 })}
            >
              {adicionar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Users className="size-4" />
              )}
              Adicionar clientes do funil
            </Button>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium text-sm">2. O que vai ser enviado</h3>
            {dadosDeTemplates?.erro ? (
              <p className="flex items-start gap-2 text-amber-700 text-sm dark:text-amber-500">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {dadosDeTemplates.erro}
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  Só aparecem templates <strong>aprovados</strong> pela Meta —
                  fora da janela de 24 horas, é o único formato que ela aceita.
                </p>
                <Select
                  value={campanha.template?.nome}
                  onValueChange={(valor) => {
                    const template = templates.find((t) => t.nome === valor);
                    if (!template) return;
                    escolher.mutate({
                      broadcastId,
                      nome: template.nome,
                      idioma: template.idioma,
                      categoria: template.categoria as
                        | "MARKETING"
                        | "UTILITY"
                        | "AUTHENTICATION",
                    });
                  }}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Escolha um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.nome} value={template.nome}>
                        {template.nome} · {template.idioma}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {campanha.template ? (
                  <p className="text-muted-foreground text-xs">
                    {
                      templates.find((t) => t.nome === campanha.template?.nome)
                        ?.corpo
                    }
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-medium text-sm">3. Disparar</h3>
            <Button
              type="button"
              disabled={
                disparar.isPending ||
                contadores.total === 0 ||
                !campanha.template
              }
              onClick={() => disparar.mutate({ broadcastId })}
            >
              {disparar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Disparar para {contadores.total} destinatário
              {contadores.total === 1 ? "" : "s"}
            </Button>
          </section>
        </>
      ) : null}

      <section className="space-y-2">
        <h3 className="font-medium text-sm">Destinatários</h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Telefone</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {campanha.destinatarios.map((destinatario) => (
                <tr key={destinatario.id} className="border-t">
                  <td className="px-3 py-2">{destinatario.nome ?? "—"}</td>
                  <td className="px-3 py-2">{destinatario.telefone}</td>
                  <td className="px-3 py-2">
                    <span className="text-muted-foreground">
                      {destinatario.status}
                    </span>
                    {destinatario.erro ? (
                      <span className="block text-destructive text-xs">
                        {destinatario.erro}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {campanha.destinatarios.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    Nenhum destinatário ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{rotulo}</p>
      <p
        className={
          destaque && valor > 0
            ? "font-semibold text-destructive text-xl"
            : "font-semibold text-xl"
        }
      >
        {valor}
      </p>
    </div>
  );
}
