"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-elapsed";
import { LayoutGrid, QrCode, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useMesasDoGarcom } from "../hooks/use-mesas";
import { LeitorDeMesa } from "./leitor-de-mesa";
import { MesaCard } from "./mesa-card";
import { PedidosALiberar } from "./pedidos-a-liberar";
import { TelaDaMesa } from "./tela-da-mesa";

const ESQUELETO = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

/**
 * O salão: a tela que abre quando o garçom entra.
 *
 * A navegação é por ESTADO, não por rota. Grade → mesa → pedido é o caminho que
 * ele faz dezenas de vezes por turno, e no celular cada troca de rota custa um
 * repintar inteiro da página.
 */
export function Salao({
  orgSlug,
  attendantId,
}: {
  orgSlug: string;
  attendantId: string;
}) {
  const { data: mesas, isLoading } = useMesasDoGarcom(orgSlug);
  const [busca, setBusca] = useState("");
  const [mesaAberta, setMesaAberta] = useState<string | null>(null);
  const [lendoQr, setLendoQr] = useState(false);
  const agora = useNow();

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return mesas ?? [];
    return (mesas ?? []).filter(
      (mesa) =>
        String(mesa.number).includes(termo) ||
        mesa.name?.toLowerCase().includes(termo) ||
        mesa.atendente?.toLowerCase().includes(termo),
    );
  }, [busca, mesas]);

  const aberta = mesas?.find((mesa) => mesa.id === mesaAberta) ?? null;

  if (aberta) {
    return (
      <TelaDaMesa
        orgSlug={orgSlug}
        attendantId={attendantId}
        mesa={aberta}
        aoVoltar={() => setMesaAberta(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-40">
      <div className="pt-3">
        <PedidosALiberar orgSlug={orgSlug} attendantId={attendantId} />
      </div>

      <div className="relative px-3">
        <Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar mesa ou cliente"
          className="h-12 pl-9 text-base"
          inputMode="search"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 px-3">
          {ESQUELETO.map((chave) => (
            <Skeleton key={chave} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (mesas ?? []).length === 0 ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>Nenhuma mesa cadastrada</EmptyTitle>
            <EmptyDescription>
              Peça ao dono para cadastrar as mesas em Pedidos → Mesas. Enquanto
              isso, dá para registrar pedido digitando o número da mesa.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-3 gap-2 px-3">
          {visiveis.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              agora={agora}
              onClick={() => setMesaAberta(mesa.id)}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center gap-4 border-t px-3 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-emerald-500" />
          Livre
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-orange-500" />
          Consumindo
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-sky-500" />
          Fechando
        </span>
      </div>

      {/* `bottom-16`, não `bottom-0`: a barra de seções do app é fixa no rodapé
          com 64px de altura, e o que ficasse em bottom-0 sumiria atrás dela. */}
      <div className="fixed inset-x-0 bottom-16 border-t bg-background p-3">
        <Button
          size="lg"
          className="h-14 w-full text-base"
          onClick={() => setLendoQr(true)}
        >
          <QrCode className="size-5" />
          Ler QR da mesa
        </Button>
      </div>

      {lendoQr && (
        <LeitorDeMesa
          orgSlug={orgSlug}
          aoFechar={() => setLendoQr(false)}
          aoAbrirMesa={(id) => {
            setLendoQr(false);
            setMesaAberta(id);
          }}
        />
      )}
    </div>
  );
}
