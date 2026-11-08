"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  LogIn,
  LogOut,
  Navigation,
  Plus,
  Route,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAdicionarAoRoteiroFv,
  useCarteiraFv,
  useCheckinFv,
  useCheckoutFv,
  useEncerrarJornadaFv,
  useIniciarJornadaFv,
  useJornadaFv,
  useOtimizarRoteiroFv,
  useRemoverDoRoteiroFv,
  useReordenarRoteiroFv,
  useRoteiroFv,
  useVisitaAbertaFv,
} from "../hooks/use-forca-vendas";
import {
  DIAS_DA_SEMANA,
  formatarDataHora,
  linkComoChegar,
} from "../lib/formatar";
import { obterPosicao } from "../lib/posicao";
import { FvPagina, Vazio } from "./fv-pagina";

const RESULTADOS = [
  { valor: "PEDIDO", rotulo: "Fez pedido" },
  { valor: "SEM_PEDIDO", rotulo: "Não comprou" },
  { valor: "FECHADO", rotulo: "Estabelecimento fechado" },
  { valor: "AUSENTE", rotulo: "Responsável ausente" },
] as const;

type Resultado = (typeof RESULTADOS)[number]["valor"];

function Jornada() {
  const { data: jornada } = useJornadaFv();
  const iniciar = useIniciarJornadaFv();
  const encerrar = useEncerrarJornadaFv();
  if (!jornada) return <Skeleton className="h-16" />;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {jornada.aberta ? "Jornada em andamento" : "Jornada não iniciada"}
        </p>
        <p className="text-xs text-muted-foreground">
          {jornada.aberta && jornada.iniciadaEm
            ? `Desde ${formatarDataHora(jornada.iniciadaEm)} · localização ligada com o módulo aberto`
            : "A localização só é registrada durante a jornada."}
        </p>
      </div>
      {jornada.aberta ? (
        <Button
          variant="outline"
          size="sm"
          disabled={encerrar.isPending}
          onClick={() => encerrar.mutate({})}
        >
          Encerrar
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={iniciar.isPending}
          onClick={() => iniciar.mutate({})}
        >
          Iniciar
        </Button>
      )}
    </div>
  );
}

function AdicionarAoRoteiro({
  diaSemana,
  aberto,
  onFechar,
}: {
  diaSemana: number;
  aberto: boolean;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const buscaAtrasada = useDebouncedValue(busca, 300);
  const consulta = useCarteiraFv(buscaAtrasada);
  const adicionar = useAdicionarAoRoteiroFv();
  const clientes =
    consulta.data?.pages.flatMap((pagina) => pagina.clientes) ?? [];
  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Adicionar ao roteiro de {DIAS_DA_SEMANA[diaSemana].toLowerCase()}
          </DialogTitle>
        </DialogHeader>
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar cliente"
        />
        <ul className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <li
              key={cliente.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {cliente.nome}
                </span>
                {cliente.cidade ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {cliente.cidade}
                  </span>
                ) : null}
              </span>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Adicionar ${cliente.nome}`}
                disabled={adicionar.isPending}
                onClick={() =>
                  adicionar.mutate({ customerId: cliente.id, diaSemana })
                }
              >
                <Plus className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function CheckinDialog({
  cliente,
  onFechar,
}: {
  cliente: { id: string; nome: string } | null;
  onFechar: () => void;
}) {
  const checkin = useCheckinFv();
  const [justificativa, setJustificativa] = useState("");
  const [pedindoJustificativa, setPedindoJustificativa] = useState<
    string | null
  >(null);
  const [localizando, setLocalizando] = useState(false);
  const [operacao] = useState(() => crypto.randomUUID());

  async function confirmar() {
    if (!cliente) return;
    setLocalizando(true);
    const posicao = await obterPosicao();
    setLocalizando(false);
    checkin.mutate(
      {
        customerId: cliente.id,
        clientOperationId: operacao,
        latitude: posicao?.latitude ?? null,
        longitude: posicao?.longitude ?? null,
        precisaoM: posicao?.precisaoM ?? null,
        justificativa: justificativa || null,
      },
      {
        onSuccess: onFechar,
        // Fora do raio: o servidor explica a distância e pede o motivo.
        onError: (error) => setPedindoJustificativa(error.message),
      },
    );
  }

  return (
    <Dialog
      open={Boolean(cliente)}
      onOpenChange={(open) => !open && onFechar()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in em {cliente?.nome}</DialogTitle>
          <DialogDescription>
            A localização do aparelho confirma que você está no cliente.
          </DialogDescription>
        </DialogHeader>
        {pedindoJustificativa ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-amber-700">{pedindoJustificativa}</p>
            <Textarea
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              placeholder="Ex.: atendi o cliente no depósito dele"
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button
            className="w-full"
            disabled={
              localizando ||
              checkin.isPending ||
              (Boolean(pedindoJustificativa) && !justificativa.trim())
            }
            onClick={confirmar}
          >
            {localizando ? "Pegando a localização…" : "Fazer check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisitaEmAndamento() {
  const { data: visita } = useVisitaAbertaFv();
  const checkout = useCheckoutFv();
  const [encerrando, setEncerrando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>("PEDIDO");
  const [motivo, setMotivo] = useState("");
  if (!visita) return null;

  async function confirmar() {
    if (!visita) return;
    const posicao = await obterPosicao(4000);
    checkout.mutate(
      {
        visitaId: visita.id,
        resultado,
        motivoSemPedido: motivo || null,
        latitude: posicao?.latitude ?? null,
        longitude: posicao?.longitude ?? null,
      },
      { onSuccess: () => setEncerrando(false) },
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary bg-primary/5 p-3">
      <p className="text-sm">
        Em visita: <strong>{visita.cliente.nome}</strong> desde{" "}
        {formatarDataHora(visita.checkinEm)}
        {visita.foraDoRaio ? (
          <Badge variant="destructive" className="ml-2">
            Fora do raio
          </Badge>
        ) : null}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild>
          <Link
            href={`/forca-de-vendas/pedidos/novo?cliente=${visita.cliente.id}`}
          >
            Fazer pedido
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setEncerrando(true)}>
          <LogOut className="size-4" />
          Check-out
        </Button>
      </div>
      <Dialog open={encerrando} onOpenChange={setEncerrando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Como foi a visita?</DialogTitle>
          </DialogHeader>
          <Select
            value={resultado}
            onValueChange={(valor) => setResultado(valor as Resultado)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESULTADOS.map((opcao) => (
                <SelectItem key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {resultado === "SEM_PEDIDO" ? (
            <Textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Por que não comprou? (estoque cheio, preço, concorrente…)"
            />
          ) : null}
          <DialogFooter>
            <Button
              className="w-full"
              disabled={
                checkout.isPending ||
                (resultado === "SEM_PEDIDO" && !motivo.trim())
              }
              onClick={confirmar}
            >
              Encerrar visita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TelaDeRota() {
  const [diaSemana, setDiaSemana] = useState(() => new Date().getDay());
  const ehHoje = diaSemana === new Date().getDay();
  const { data: paradas, isPending } = useRoteiroFv(diaSemana);
  const remover = useRemoverDoRoteiroFv();
  const reordenar = useReordenarRoteiroFv();
  const otimizar = useOtimizarRoteiroFv();
  const { data: visitaAberta } = useVisitaAbertaFv();
  const [adicionando, setAdicionando] = useState(false);
  const [checkinEm, setCheckinEm] = useState<{
    id: string;
    nome: string;
  } | null>(null);

  function mover(indice: number, delta: number) {
    if (!paradas) return;
    const ids = paradas.map((parada) => parada.roteiroId);
    const destino = indice + delta;
    if (destino < 0 || destino >= ids.length) return;
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    reordenar.mutate({ roteiroIds: ids });
  }

  async function otimizarRota() {
    const origem = await obterPosicao(4000);
    otimizar.mutate({
      diaSemana,
      origem: origem
        ? { latitude: origem.latitude, longitude: origem.longitude }
        : null,
    });
  }

  return (
    <FvPagina
      titulo="Rota"
      acao={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdicionando(true)}
        >
          <Plus className="size-4" />
          Cliente
        </Button>
      }
    >
      <Jornada />
      <VisitaEmAndamento />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {DIAS_DA_SEMANA.map((dia, indice) => (
          <Button
            key={dia}
            size="sm"
            variant={diaSemana === indice ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setDiaSemana(indice)}
          >
            {dia.slice(0, 3)}
            {indice === new Date().getDay() ? " · hoje" : ""}
          </Button>
        ))}
      </div>

      {isPending ? (
        <Skeleton className="h-40" />
      ) : !paradas || paradas.length === 0 ? (
        <Vazio>
          Nenhum cliente no roteiro de {DIAS_DA_SEMANA[diaSemana].toLowerCase()}
          .
        </Vazio>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={otimizar.isPending}
            onClick={otimizarRota}
          >
            <Route className="size-4" />
            Organizar pelo menor caminho
          </Button>
          <ol className="flex flex-col gap-2">
            {paradas.map((parada, indice) => {
              const comoChegar = linkComoChegar({
                latitude: parada.cliente.localizacao?.latitude,
                longitude: parada.cliente.localizacao?.longitude,
                endereco: parada.cliente.endereco,
              });
              const visitado = Boolean(parada.visita);
              return (
                <li
                  key={parada.roteiroId}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {visitado ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        indice + 1
                      )}
                    </span>
                    <Link
                      href={`/forca-de-vendas/clientes/${parada.cliente.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate font-medium">
                        {parada.cliente.nome}
                      </p>
                      {parada.cliente.endereco ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {parada.cliente.endereco}
                        </p>
                      ) : null}
                      {parada.visita ? (
                        <p className="text-xs text-emerald-600">
                          Visitado {formatarDataHora(parada.visita.checkinEm)}
                          {parada.visita.foraDoRaio ? " · fora do raio" : ""}
                        </p>
                      ) : null}
                    </Link>
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Subir"
                        onClick={() => mover(indice, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Descer"
                        onClick={() => mover(indice, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ehHoje && !visitado && !visitaAberta ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          setCheckinEm({
                            id: parada.cliente.id,
                            nome: parada.cliente.nome,
                          })
                        }
                      >
                        <LogIn className="size-4" />
                        Check-in
                      </Button>
                    ) : null}
                    {comoChegar ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        asChild
                      >
                        <a
                          href={comoChegar}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Navigation className="size-4" />
                          Como chegar
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label="Tirar do roteiro"
                      onClick={() =>
                        remover.mutate({ roteiroId: parada.roteiroId })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <AdicionarAoRoteiro
        diaSemana={diaSemana}
        aberto={adicionando}
        onFechar={() => setAdicionando(false)}
      />
      <CheckinDialog
        key={checkinEm?.id ?? "nenhum"}
        cliente={checkinEm}
        onFechar={() => setCheckinEm(null)}
      />
    </FvPagina>
  );
}
