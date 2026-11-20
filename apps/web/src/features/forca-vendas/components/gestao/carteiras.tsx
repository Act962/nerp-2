"use client";

import { MapPin, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAtribuirCarteiraGestao,
  useCidadesGestao,
  useClientesDaCarteiraGestao,
  useRemoverDaCarteiraGestao,
  useVendedoresGestao,
} from "../../hooks/use-gestao-fv";

type Situacao = "DA_CARTEIRA" | "SEM_CARTEIRA" | "TODOS";

export function GestaoDeCarteiras() {
  const { data: vendedores = [], isPending: carregandoVendedores } =
    useVendedoresGestao();
  const { data: cidades = [] } = useCidadesGestao();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<Situacao>("DA_CARTEIRA");
  const [cidade, setCidade] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const buscaAtrasada = useDebouncedValue(busca, 300);
  const vendedorId = memberId ?? vendedores[0]?.memberId ?? null;
  const consulta = useClientesDaCarteiraGestao({
    memberId: vendedorId,
    busca: buscaAtrasada,
    cidade,
    situacao,
  });
  const atribuir = useAtribuirCarteiraGestao();
  const remover = useRemoverDaCarteiraGestao();
  const clientes =
    consulta.data?.pages.flatMap((pagina) => pagina.clientes) ?? [];
  const vendedor = vendedores.find((linha) => linha.memberId === vendedorId);

  const alternar = (id: string) =>
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  if (carregandoVendedores) return <Skeleton className="h-64" />;
  if (vendedores.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum vendedor ainda. Dê a permissão &quot;App Força de Vendas&quot; ou
        o cargo Vendedor(a) a alguém da equipe em Configurações → Membros.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Vendedor</span>
          <Select
            value={vendedorId ?? undefined}
            onValueChange={(valor) => {
              setMemberId(valor);
              setSelecionados(new Set());
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vendedores.map((linha) => (
                <SelectItem key={linha.memberId} value={linha.memberId}>
                  {linha.nome} · {linha.clientes} clientes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Mostrar</span>
          <Select
            value={situacao}
            onValueChange={(valor) => {
              setSituacao(valor as Situacao);
              setSelecionados(new Set());
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DA_CARTEIRA">Clientes da carteira</SelectItem>
              <SelectItem value="SEM_CARTEIRA">
                Clientes sem vendedor
              </SelectItem>
              <SelectItem value="TODOS">Todos os clientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Cidade</span>
          <Select
            value={cidade ?? "todas"}
            onValueChange={(valor) =>
              setCidade(valor === "todas" ? null : valor)
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as cidades</SelectItem>
              {cidades.map((linha) => (
                <SelectItem key={linha.cidade} value={linha.cidade}>
                  {linha.cidade} ({linha.clientes})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar cliente"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {selecionados.size > 0
            ? `${selecionados.size} selecionado(s)`
            : `Carteira de ${vendedor?.nome ?? ""}`}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {cidade && vendedorId ? (
            <Button
              variant="outline"
              disabled={atribuir.isPending}
              onClick={() =>
                atribuir.mutate({
                  memberId: vendedorId,
                  customerIds: [],
                  cidade,
                })
              }
            >
              <MapPin className="size-4" />
              Pôr {cidade} inteira na carteira
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={
              selecionados.size === 0 || remover.isPending || !vendedorId
            }
            onClick={() =>
              vendedorId &&
              remover.mutate(
                { memberId: vendedorId, customerIds: [...selecionados] },
                { onSuccess: () => setSelecionados(new Set()) },
              )
            }
          >
            Tirar da carteira
          </Button>
          <Button
            disabled={
              selecionados.size === 0 || atribuir.isPending || !vendedorId
            }
            onClick={() =>
              vendedorId &&
              atribuir.mutate(
                { memberId: vendedorId, customerIds: [...selecionados] },
                { onSuccess: () => setSelecionados(new Set()) },
              )
            }
          >
            Pôr na carteira
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Cliente</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Vendedores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consulta.isPending ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-10" />
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  {situacao === "DA_CARTEIRA"
                    ? 'Carteira vazia. Mude para "Clientes sem vendedor" para montar.'
                    : "Nenhum cliente encontrado."}
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell>
                    <Checkbox
                      checked={selecionados.has(cliente.id)}
                      onCheckedChange={() => alternar(cliente.id)}
                      aria-label={`Selecionar ${cliente.nome}`}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{cliente.nome}</span>
                    {cliente.naCarteira && situacao !== "DA_CARTEIRA" ? (
                      <Badge variant="secondary" className="ml-2">
                        Na carteira
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{cliente.cidade ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {cliente.documento ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cliente.vendedores.length > 0
                      ? cliente.vendedores.join(", ")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {consulta.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => consulta.fetchNextPage()}
          disabled={consulta.isFetchingNextPage}
        >
          {consulta.isFetchingNextPage ? <Spinner /> : "Carregar mais"}
        </Button>
      ) : null}
    </div>
  );
}
