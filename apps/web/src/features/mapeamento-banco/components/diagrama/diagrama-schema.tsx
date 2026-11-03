"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import {
  FingerprintIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  SearchIcon,
  ZapIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type {
  ColunaDoDiagrama,
  TabelaDoDiagrama,
} from "../../application/diagrama";
import type { TabelaRef } from "../../domain/estrutura";
import { useDiagramaDoBanco } from "../../hooks/use-mapeamento-banco";
import { LARGURA_DO_NO, alturaDoNo, posicionar } from "./layout";
import { type DadosDoNo, type NoDaTabela, NoTabela } from "./no-tabela";

// Diagrama do schema no molde do Schema Visualizer do Supabase: um cartão por
// tabela, traço tracejado para chave declarada e pontilhado para a inferida
// pelo nome (ver `domain/diagrama.ts`), layout automático pelo dagre.

const TIPOS_DE_NO = { tabela: NoTabela };

/** Cartão fechado mostra chaves e colunas ligadas, completando até isto. */
const MINIMO_DE_COLUNAS = 6;

function colunasDoCartao(
  tabela: TabelaDoDiagrama,
  ligadas: Set<string>,
  expandida: boolean,
): { colunas: ColunaDoDiagrama[]; ocultas: number } {
  if (expandida) return { colunas: tabela.colunas, ocultas: 0 };
  const essenciais = new Set(
    tabela.colunas
      .filter((coluna) => coluna.chavePrimaria || ligadas.has(coluna.nome))
      .map((coluna) => coluna.nome),
  );
  const faltam = Math.max(0, MINIMO_DE_COLUNAS - essenciais.size);
  for (const coluna of tabela.colunas) {
    if (essenciais.size >= MINIMO_DE_COLUNAS || faltam === 0) break;
    essenciais.add(coluna.nome);
  }
  const colunas = tabela.colunas.filter((coluna) =>
    essenciais.has(coluna.nome),
  );
  return { colunas, ocultas: tabela.colunas.length - colunas.length };
}

interface Props {
  onAbrirTabela: (tabela: TabelaRef) => void;
}

export function DiagramaSchema(props: Props) {
  return (
    <ReactFlowProvider>
      <Diagrama {...props} />
    </ReactFlowProvider>
  );
}

function Diagrama({ onAbrirTabela }: Props) {
  const [schema, setSchema] = useState<string | null>(null);
  const [comInferidas, setComInferidas] = useState(true);
  const [comSoltas, setComSoltas] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [destaque, setDestaque] = useState<string | null>(null);
  const [versaoDoLayout, setVersaoDoLayout] = useState(0);
  const [buscaAberta, setBuscaAberta] = useState(false);

  const diagrama = useDiagramaDoBanco(schema);
  const dados = diagrama.data;
  const { resolvedTheme } = useTheme();
  const fluxo = useReactFlow();
  const [nos, setNos, onNodesChange] = useNodesState<NoDaTabela>([]);

  const ligacoes = useMemo(
    () =>
      (dados?.ligacoes ?? []).filter(
        (ligacao) => comInferidas || ligacao.origem === "declarada",
      ),
    [dados, comInferidas],
  );

  const ligadasPorTabela = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    const marcar = (id: string, colunas: string[]) => {
      const atual = mapa.get(id) ?? new Set<string>();
      for (const coluna of colunas) atual.add(coluna);
      mapa.set(id, atual);
    };
    for (const ligacao of ligacoes) {
      marcar(ligacao.de, ligacao.colunasDe);
      marcar(ligacao.para, ligacao.colunasPara);
    }
    return mapa;
  }, [ligacoes]);

  const visiveis = useMemo(() => {
    const tabelas = dados?.tabelas ?? [];
    // Schema sem nenhuma ligação: esconder as soltas deixaria a tela vazia.
    if (comSoltas || ligadasPorTabela.size === 0) return tabelas;
    return tabelas.filter((tabela) => ligadasPorTabela.has(tabela.id));
  }, [dados, comSoltas, ligadasPorTabela]);
  const soltas = (dados?.tabelas.length ?? 0) - ligadasPorTabela.size;

  const alternar = useCallback((id: string) => {
    setExpandidas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }, []);

  const abrir = useCallback(
    (id: string) => {
      const tabela = dados?.tabelas.find((item) => item.id === id);
      if (tabela) onAbrirTabela({ schema: tabela.schema, nome: tabela.nome });
    },
    [dados, onAbrirTabela],
  );

  const dadosDoNo = useCallback(
    (tabela: TabelaDoDiagrama): DadosDoNo => {
      const ligadas = ligadasPorTabela.get(tabela.id) ?? new Set<string>();
      const expandida = expandidas.has(tabela.id);
      const { colunas, ocultas } = colunasDoCartao(tabela, ligadas, expandida);
      return {
        tabela,
        colunas,
        ocultas,
        expandida,
        ligadas: [...ligadas],
        destaque: destaque === tabela.id,
        onAlternar: alternar,
        onAbrir: abrir,
      };
    },
    [ligadasPorTabela, expandidas, destaque, alternar, abrir],
  );

  // Reposiciona tudo só quando o CONJUNTO muda (schema, filtros, botão de
  // layout). Expandir um cartão ou destacar não mexe nas posições — o que o
  // usuário arrastou continua onde ele deixou.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dadosDoNo muda a cada expandir/destacar e não deve reposicionar
  useEffect(() => {
    if (!dados) return;
    const comAltura = visiveis.map((tabela) => {
      const dadosDoCartao = dadosDoNo(tabela);
      return {
        id: tabela.id,
        dados: dadosDoCartao,
        altura: alturaDoNo(
          dadosDoCartao.colunas.length,
          dadosDoCartao.ocultas > 0 || dadosDoCartao.expandida,
        ),
      };
    });
    const posicoes = posicionar(
      comAltura,
      ligacoes.map((ligacao) => ({ de: ligacao.de, para: ligacao.para })),
    );
    setNos(
      comAltura.map((no) => ({
        id: no.id,
        type: "tabela" as const,
        position: posicoes.get(no.id) ?? { x: 0, y: 0 },
        data: no.dados,
      })),
    );
    requestAnimationFrame(() =>
      fluxo.fitView({ padding: 0.08, duration: 300 }),
    );
  }, [dados, visiveis, ligacoes, versaoDoLayout]);

  // Expandir e destacar só trocam o conteúdo dos cartões.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setNos é estável; dados vem de dadosDoNo
  useEffect(() => {
    setNos((atuais) =>
      atuais.map((no) => ({ ...no, data: dadosDoNo(no.data.tabela) })),
    );
  }, [dadosDoNo]);

  const presentes = useMemo(
    () => new Set(visiveis.map((tabela) => tabela.id)),
    [visiveis],
  );
  const arestas: Edge[] = useMemo(
    () =>
      ligacoes
        .filter(
          (ligacao) => presentes.has(ligacao.de) && presentes.has(ligacao.para),
        )
        .map((ligacao) => {
          const ligadaAoDestaque =
            destaque !== null &&
            (ligacao.de === destaque || ligacao.para === destaque);
          const apagada = destaque !== null && !ligadaAoDestaque;
          const declarada = ligacao.origem === "declarada";
          return {
            id: ligacao.id,
            source: ligacao.de,
            target: ligacao.para,
            sourceHandle: `${ligacao.colunasDe[0]}-s`,
            targetHandle: `${ligacao.colunasPara[0]}-t`,
            type: "smoothstep",
            zIndex: ligadaAoDestaque ? 10 : 0,
            style: {
              stroke: ligadaAoDestaque
                ? "var(--primary)"
                : declarada
                  ? "var(--foreground)"
                  : "var(--muted-foreground)",
              strokeDasharray: declarada ? "6 4" : "2 4",
              strokeWidth: ligadaAoDestaque ? 2 : 1.25,
              opacity: apagada ? 0.15 : 0.85,
            },
          };
        }),
    [ligacoes, presentes, destaque],
  );

  const irPara = (id: string) => {
    const no = fluxo.getNode(id);
    setBuscaAberta(false);
    setDestaque(id);
    if (!no) return;
    fluxo.setCenter(no.position.x + LARGURA_DO_NO / 2, no.position.y + 120, {
      zoom: 1,
      duration: 500,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Select
          value={dados?.schema ?? ""}
          onValueChange={(valor) => {
            setSchema(valor);
            setExpandidas(new Set());
            setDestaque(null);
          }}
        >
          <SelectTrigger size="sm" className="w-52 font-mono text-xs">
            <span className="font-sans text-muted-foreground">schema</span>
            <SelectValue placeholder="…" />
          </SelectTrigger>
          <SelectContent>
            {dados?.schemas.map((opcao) => (
              <SelectItem
                key={opcao.nome}
                value={opcao.nome}
                className="font-mono text-xs"
              >
                {opcao.nome}
                <span className="text-muted-foreground">{opcao.tabelas}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={buscaAberta} onOpenChange={setBuscaAberta}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!dados}
            >
              <SearchIcon />
              Ir para tabela
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar tabela…" className="text-xs" />
              <CommandList>
                <CommandEmpty>Nenhuma tabela no diagrama.</CommandEmpty>
                <CommandGroup>
                  {visiveis.map((tabela) => (
                    <CommandItem
                      key={tabela.id}
                      value={`${tabela.nome} ${tabela.rotulo ?? ""}`}
                      onSelect={() => irPara(tabela.id)}
                    >
                      <span className="font-mono text-xs">{tabela.nome}</span>
                      {tabela.rotulo && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {tabela.rotulo}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <label
            htmlFor="diagrama-inferidas"
            className="flex items-center gap-2 text-xs"
          >
            <Switch
              id="diagrama-inferidas"
              checked={comInferidas}
              onCheckedChange={setComInferidas}
            />
            Ligações inferidas pelo nome
          </label>
          <label
            htmlFor="diagrama-soltas"
            className="flex items-center gap-2 text-xs"
          >
            <Switch
              id="diagrama-soltas"
              checked={comSoltas}
              onCheckedChange={setComSoltas}
              disabled={soltas <= 0}
            />
            Tabelas sem ligação ({Math.max(0, soltas)})
          </label>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setVersaoDoLayout((atual) => atual + 1)}
            disabled={!dados}
          >
            <LayoutGridIcon />
            Auto layout
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {diagrama.error ? (
          <p className="p-4 text-destructive text-sm">
            {diagrama.error.message}
          </p>
        ) : !dados ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            Lendo o schema do banco do ERP — a primeira vez leva alguns
            segundos.
          </div>
        ) : (
          <ReactFlow
            nodes={nos}
            edges={arestas}
            onNodesChange={onNodesChange}
            nodeTypes={TIPOS_DE_NO}
            onNodeClick={(_evento, no) =>
              setDestaque((atual) => (atual === no.id ? null : no.id))
            }
            onPaneClick={() => setDestaque(null)}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
            minZoom={0.05}
            maxZoom={1.5}
            nodesConnectable={false}
            onlyRenderVisibleElements
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <Controls showInteractive={false} />
            {/* No alto: embaixo à direita fica o botão flutuante do Astro. */}
            <MiniMap
              position="top-right"
              pannable
              zoomable
              className="max-md:hidden"
              nodeColor="var(--muted-foreground)"
              maskColor="color-mix(in oklch, var(--background) 70%, transparent)"
            />
          </ReactFlow>
        )}
        {diagrama.isFetching && dados && (
          <div className="absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border bg-background px-3 py-1 text-xs shadow-sm">
            <Spinner className="size-3" />
            Lendo o schema…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <KeyRoundIcon className="size-3 text-amber-500" /> Chave primária
        </span>
        <span className="flex items-center gap-1">
          <FingerprintIcon className="size-3" /> Única
        </span>
        <span className="flex items-center gap-1">
          <ZapIcon className="size-3 text-emerald-500" /> Índice líder
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rotate-45 border border-foreground/70" />{" "}
          Aceita nulo
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rotate-45 border border-foreground/70 bg-foreground/70" />{" "}
          Obrigatória
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="22"
              y2="3"
              stroke="currentColor"
              strokeDasharray="6 4"
            />
          </svg>
          Chave declarada
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="22"
              y2="3"
              stroke="currentColor"
              strokeDasharray="2 4"
            />
          </svg>
          Inferida pelo nome
        </span>
      </div>
    </div>
  );
}
