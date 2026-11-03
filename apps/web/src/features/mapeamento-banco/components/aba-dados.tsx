"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TabelaDescrita } from "../application/descrever-tabela";
import { podeFiltrarOuOrdenarPor } from "../domain/estrutura";
import {
  type PedidoDeAmostraDaTela,
  useAmostraDaTabela,
} from "../hooks/use-mapeamento-banco";
import { tabelaGrande, textoDaCelula } from "./formatar";

const SEM_ORDEM = "__sem_ordem__";

export function AbaDados({ tabela }: { tabela: TabelaDescrita }) {
  const exibiveis = useMemo(
    () => tabela.colunas.filter((coluna) => coluna.tipo !== "outro"),
    [tabela],
  );
  // Em tabela grande, filtro e ordem só por coluna que abre índice — a mesma
  // regra que o servidor aplica; aqui ela só evita oferecer o que seria recusado.
  const liberadas = useMemo(
    () =>
      exibiveis.filter(
        (coluna) => podeFiltrarOuOrdenarPor(tabela, coluna.nome).ok,
      ),
    [exibiveis, tabela],
  );

  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [colunaDoFiltro, setColunaDoFiltro] = useState<string>("");
  const [valorDoFiltro, setValorDoFiltro] = useState("");
  const [filtro, setFiltro] = useState<PedidoDeAmostraDaTela["filtro"]>(null);
  const [ordem, setOrdem] = useState<PedidoDeAmostraDaTela["ordem"]>(null);
  const [pagina, setPagina] = useState(0);

  // Troca de tabela zera o que era da anterior.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o gatilho é a tabela, não as variáveis zeradas
  useEffect(() => {
    setOcultas(new Set());
    setColunaDoFiltro(liberadas[0]?.nome ?? "");
    setValorDoFiltro("");
    setFiltro(null);
    setOrdem(null);
    setPagina(0);
  }, [tabela.schema, tabela.nome]);

  const visiveis = exibiveis.filter((coluna) => !ocultas.has(coluna.nome));
  const pedido: PedidoDeAmostraDaTela = {
    tabela: { schema: tabela.schema, nome: tabela.nome },
    colunas:
      ocultas.size > 0 ? visiveis.map((coluna) => coluna.nome) : undefined,
    filtro,
    ordem,
    pagina,
  };
  const amostra = useAmostraDaTabela(visiveis.length > 0 ? pedido : null);
  const dados = amostra.data;
  const tipoPorColuna = new Map(
    tabela.colunas.map((coluna) => [coluna.nome, coluna.tipo]),
  );

  const aplicarFiltro = () => {
    setPagina(0);
    setFiltro(
      colunaDoFiltro && valorDoFiltro.trim()
        ? { coluna: colunaDoFiltro, valor: valorDoFiltro.trim() }
        : null,
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            aplicarFiltro();
          }}
        >
          <Select value={colunaDoFiltro} onValueChange={setColunaDoFiltro}>
            <SelectTrigger size="sm" className="w-40 font-mono text-xs">
              <SelectValue placeholder="Coluna" />
            </SelectTrigger>
            <SelectContent>
              {liberadas.map((coluna) => (
                <SelectItem
                  key={coluna.nome}
                  value={coluna.nome}
                  className="font-mono text-xs"
                >
                  {coluna.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">=</span>
          <Input
            value={valorDoFiltro}
            onChange={(evento) => setValorDoFiltro(evento.target.value)}
            placeholder={
              tipoPorColuna.get(colunaDoFiltro) === "data"
                ? "AAAA-MM-DD"
                : "valor"
            }
            className="h-8 w-36 font-mono text-xs"
          />
          <Button type="submit" size="sm" variant="secondary" className="h-8">
            Filtrar
          </Button>
          {filtro && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => {
                setFiltro(null);
                setValorDoFiltro("");
                setPagina(0);
              }}
            >
              <XIcon />
              {filtro.coluna} = {filtro.valor}
            </Button>
          )}
        </form>

        <div className="flex items-center gap-2">
          <Select
            value={ordem?.coluna ?? SEM_ORDEM}
            onValueChange={(valor) => {
              setPagina(0);
              setOrdem(
                valor === SEM_ORDEM
                  ? null
                  : { coluna: valor, direcao: ordem?.direcao ?? "asc" },
              );
            }}
          >
            <SelectTrigger size="sm" className="w-36 text-xs">
              <SelectValue placeholder="Ordem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_ORDEM} className="text-xs">
                Sem ordem
              </SelectItem>
              {liberadas.map((coluna) => (
                <SelectItem
                  key={coluna.nome}
                  value={coluna.nome}
                  className="font-mono text-xs"
                >
                  {coluna.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ordem && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Inverter ordem"
              onClick={() =>
                setOrdem({
                  ...ordem,
                  direcao: ordem.direcao === "asc" ? "desc" : "asc",
                })
              }
            >
              {ordem.direcao === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                <Columns3Icon />
                {visiveis.length}/{exibiveis.length}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                <span className="font-medium">Colunas</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setOcultas(new Set())}
                >
                  Mostrar todas
                </button>
              </div>
              <ScrollArea className="h-72">
                <div className="flex flex-col p-1">
                  {exibiveis.map((coluna) => (
                    <label
                      key={coluna.nome}
                      htmlFor={`coluna-visivel-${coluna.nome}`}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 font-mono text-xs hover:bg-accent"
                    >
                      <Checkbox
                        id={`coluna-visivel-${coluna.nome}`}
                        checked={!ocultas.has(coluna.nome)}
                        onCheckedChange={(marcado) =>
                          setOcultas((atual) => {
                            const proximo = new Set(atual);
                            if (marcado) proximo.delete(coluna.nome);
                            else proximo.add(coluna.nome);
                            return proximo;
                          })
                        }
                      />
                      {coluna.nome}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {tabelaGrande(tabela.linhas) && (
        <p className="border-b bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          Tabela grande: filtro e ordem só pelas colunas que abrem índice (
          {liberadas.map((coluna) => coluna.nome).join(", ") || "nenhuma"}).
        </p>
      )}

      <div className="relative min-h-0 flex-1 overflow-auto">
        {amostra.error ? (
          <p className="p-4 text-destructive text-sm">
            {amostra.error.message}
          </p>
        ) : !dados && amostra.isLoading ? (
          <p className="p-4 text-muted-foreground text-sm">
            Lendo do banco do ERP…
          </p>
        ) : dados && dados.linhas.length === 0 ? (
          <p className="p-4 text-muted-foreground text-sm">Nenhuma linha.</p>
        ) : dados ? (
          <table
            className={cn(
              "w-max min-w-full border-collapse font-mono text-xs",
              amostra.isFetching && "opacity-60",
            )}
          >
            <thead className="sticky top-0 z-10 bg-background">
              <tr>
                {dados.colunas.map((nome) => (
                  <th
                    key={nome}
                    className="border-r border-b px-2 py-1.5 text-left font-medium text-muted-foreground"
                  >
                    {nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((linha, indice) => (
                <tr key={indice} className="hover:bg-accent/40">
                  {dados.colunas.map((nome) => {
                    const valor = linha[nome] ?? null;
                    return (
                      <td
                        key={nome}
                        title={valor === null ? undefined : String(valor)}
                        className={cn(
                          "max-w-80 truncate whitespace-nowrap border-r border-b px-2 py-1",
                          tipoPorColuna.get(nome) === "numero" &&
                            "text-right tabular-nums",
                          valor === null && "text-muted-foreground/60 italic",
                        )}
                      >
                        {textoDaCelula(valor)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-muted-foreground text-xs">
        <span className="tabular-nums">
          {dados
            ? `Linhas ${pagina * 50 + 1}–${pagina * 50 + dados.linhas.length} · ${dados.tempoMs} ms`
            : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={pagina === 0 || amostra.isFetching}
            onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
            aria-label="Página anterior"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="tabular-nums">{pagina + 1}</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={!dados?.temMais || amostra.isFetching}
            onClick={() => setPagina((atual) => atual + 1)}
            aria-label="Próxima página"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
