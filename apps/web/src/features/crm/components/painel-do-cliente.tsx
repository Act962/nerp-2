"use client";

import { ExternalLink, Loader2, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatWhatsapp } from "@/lib/whatsapp";
import { useAtualizarLead, useEtapas, useLead } from "../hooks/use-lead";
import { EncerrarLead } from "./encerrar-lead";
import { EtiquetasDoLead } from "./etiquetas-do-lead";

const TEMPERATURAS = [
  { valor: "COLD", rotulo: "Frio" },
  { valor: "WARM", rotulo: "Morno" },
  { valor: "HOT", rotulo: "Quente" },
  { valor: "VERY_HOT", rotulo: "Muito quente" },
] as const;

const ATENDIMENTO = [
  { valor: "NEW", rotulo: "Novo" },
  { valor: "WAITING", rotulo: "Esperando" },
  { valor: "ACTIVE", rotulo: "Em atendimento" },
  { valor: "FINISHED", rotulo: "Encerrado" },
] as const;

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * O CRM ao lado da conversa.
 *
 * É o ponto do módulo inteiro: quem responde a mensagem vê, sem trocar de
 * tela, em que etapa o cliente está e o que ele já comprou. Mover de etapa
 * daqui grava histórico, igual a mover no board.
 */
export function PainelDoCliente({
  leadId,
  funnelId,
}: {
  leadId: string;
  funnelId: string | null;
}) {
  const { data: lead, isPending } = useLead(leadId);
  const { data: dadosDeEtapas } = useEtapas(funnelId);
  const atualizar = useAtualizarLead();

  if (isPending || !lead) {
    return (
      <div className="flex items-center gap-2 border-l p-4 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando ficha…
      </div>
    );
  }

  const etapas = dadosDeEtapas?.etapas ?? [];

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-l p-4">
      <div>
        <p className="font-medium">{lead.nome}</p>
        {lead.telefone ? (
          <p className="text-muted-foreground text-sm">
            {formatWhatsapp(lead.telefone)}
          </p>
        ) : null}
      </div>

      <Campo rotulo="Etapa">
        <Select
          value={lead.estagio.id}
          onValueChange={(valor) =>
            atualizar.mutate({ leadId, estagioId: valor })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {etapas.map((etapa) => (
              <SelectItem key={etapa.id} value={etapa.id}>
                {etapa.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>

      <Campo rotulo="Atendimento">
        <Select
          value={lead.statusFlow}
          onValueChange={(valor) =>
            atualizar.mutate({
              leadId,
              statusFlow: valor as (typeof ATENDIMENTO)[number]["valor"],
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATENDIMENTO.map((item) => (
              <SelectItem key={item.valor} value={item.valor}>
                {item.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>

      <Campo rotulo="Interesse">
        <Select
          value={lead.temperatura}
          onValueChange={(valor) =>
            atualizar.mutate({
              leadId,
              temperatura: valor as (typeof TEMPERATURAS)[number]["valor"],
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPERATURAS.map((item) => (
              <SelectItem key={item.valor} value={item.valor}>
                {item.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>

      <Campo rotulo="Etiquetas">
        <EtiquetasDoLead
          leadId={leadId}
          funnelId={funnelId ?? ""}
          atuais={lead.tags}
        />
      </Campo>

      {funnelId ? (
        <EncerrarLead
          leadId={leadId}
          funnelId={funnelId}
          situacao={lead.situacao}
        />
      ) : null}

      <div className="rounded-lg border p-3">
        {lead.cliente ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <ShoppingBag className="size-4 text-muted-foreground" />
              <span className="font-medium text-sm">Cliente do ERP</span>
            </div>
            <p className="text-sm">{lead.cliente.nome}</p>
            <p className="text-muted-foreground text-xs">
              {lead.cliente.totalDeCompras} compra
              {lead.cliente.totalDeCompras === 1 ? "" : "s"} ·{" "}
              {dinheiro.format(lead.cliente.valorTotal)}
            </p>

            {lead.cliente.ultimasCompras.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {lead.cliente.ultimasCompras.map((compra) => (
                  <li
                    key={compra.id}
                    className="flex justify-between text-muted-foreground text-xs"
                  >
                    <span>
                      {new Date(compra.data).toLocaleDateString("pt-BR")}
                    </span>
                    <span>{dinheiro.format(compra.total)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <Link
              href={`/clientes?cliente=${lead.cliente.id}`}
              className="mt-3 inline-flex items-center gap-1 text-primary text-xs hover:underline"
            >
              Abrir no cadastro
              <ExternalLink className="size-3" />
            </Link>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <span className="font-medium text-sm">Sem cliente vinculado</span>
            </div>
            <p className="text-muted-foreground text-xs">
              O telefone não casou com nenhum cliente do cadastro — ou casou com
              mais de um, e nesse caso o sistema não escolhe por você.
            </p>
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Primeiro contato em{" "}
        {new Date(lead.criadoEm).toLocaleDateString("pt-BR")}
      </p>
    </aside>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {rotulo}
      </span>
      {children}
    </div>
  );
}
