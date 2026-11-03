"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useMapaGestao,
  useResumoVisitasGestao,
  useTrajetoGestao,
} from "../../hooks/use-gestao-fv";
import { formatarDataHora } from "../../lib/formatar";

// Leaflet usa `window` no topo do módulo: só no navegador.
const MapaCanvas = dynamic(
  () => import("./mapa-canvas").then((mod) => ({ default: mod.MapaCanvas })),
  { ssr: false, loading: () => <Skeleton className="h-[480px] w-full" /> },
);

const RESULTADO: Record<string, string> = {
  PEDIDO: "Pedido",
  SEM_PEDIDO: "Sem pedido",
  FECHADO: "Fechado",
  AUSENTE: "Ausente",
};

function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function MapaDaEquipe() {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [dia, setDia] = useState(hojeIso);
  const { data: equipe = [], isPending } = useMapaGestao();
  const { data: trajeto = [] } = useTrajetoGestao(selecionado, dia);
  const { data: resumo } = useResumoVisitasGestao(dia);
  const selecionar = useCallback(
    (memberId: string) =>
      setSelecionado((atual) => (atual === memberId ? null : memberId)),
    [],
  );

  const pinos = equipe.flatMap((vendedor) =>
    vendedor.ultimaPosicao
      ? [
          {
            memberId: vendedor.memberId,
            nome: vendedor.nome,
            latitude: vendedor.ultimaPosicao.latitude,
            longitude: vendedor.ultimaPosicao.longitude,
            emJornada: Boolean(vendedor.jornadaDesde),
            detalhe: formatarDataHora(vendedor.ultimaPosicao.em),
          },
        ]
      : [],
  );
  const planejadasPor = new Map(
    resumo?.planejadas.map((linha) => [linha.memberId, linha.quantidade]),
  );
  const visitasDoDia = resumo?.visitas ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MapaCanvas
          pinos={pinos}
          trajeto={trajeto}
          selecionado={selecionado}
          onSelecionar={selecionar}
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Equipe agora</h2>
            <Input
              type="date"
              value={dia}
              onChange={(event) => setDia(event.target.value)}
              className="w-40"
            />
          </div>
          {isPending ? (
            <Skeleton className="h-40" />
          ) : equipe.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum vendedor no seu escopo.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {equipe.map((vendedor) => {
                const visitados = visitasDoDia.filter(
                  (visita) => visita.memberId === vendedor.memberId,
                );
                const positivados = visitados.filter(
                  (visita) => visita.resultado === "PEDIDO",
                ).length;
                return (
                  <li key={vendedor.memberId}>
                    <button
                      type="button"
                      onClick={() => selecionar(vendedor.memberId)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left text-sm hover:bg-accent",
                        selecionado === vendedor.memberId &&
                          "border-primary bg-primary/5",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{vendedor.nome}</span>
                        {vendedor.jornadaDesde ? (
                          <Badge className="bg-emerald-600 text-white">
                            Em jornada
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Fora</Badge>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {vendedor.ultimaPosicao
                          ? `Visto ${formatarDataHora(vendedor.ultimaPosicao.em)}${vendedor.ultimaPosicao.bateria != null ? ` · bateria ${vendedor.ultimaPosicao.bateria}%` : ""}`
                          : "Sem posição registrada"}
                      </span>
                      <span className="block text-xs tabular-nums">
                        Planejadas {planejadasPor.get(vendedor.memberId) ?? 0} ·
                        visitadas {visitados.length} · com pedido {positivados}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Check-in</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Local</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitasDoDia.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhuma visita registrada neste dia.
                </TableCell>
              </TableRow>
            ) : (
              visitasDoDia.map((visita) => (
                <TableRow key={visita.id}>
                  <TableCell className="tabular-nums">
                    {formatarDataHora(visita.checkinEm)}
                  </TableCell>
                  <TableCell>
                    {equipe.find(
                      (vendedor) => vendedor.memberId === visita.memberId,
                    )?.nome ?? "—"}
                  </TableCell>
                  <TableCell>{visita.cliente}</TableCell>
                  <TableCell>
                    {visita.resultado
                      ? RESULTADO[visita.resultado]
                      : "Em andamento"}
                    {visita.motivoSemPedido ? (
                      <span className="block text-xs text-muted-foreground">
                        {visita.motivoSemPedido}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {visita.foraDoRaio ? (
                      <span className="text-destructive">
                        Fora do raio
                        {visita.distanciaClienteM != null
                          ? ` (${visita.distanciaClienteM} m)`
                          : ""}
                        {visita.justificativa ? (
                          <span className="block text-xs text-muted-foreground">
                            {visita.justificativa}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "No cliente"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
