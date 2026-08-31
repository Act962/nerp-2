"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDown,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CrmNodeType } from "@/generated/prisma/enums";
import { orpc } from "@/lib/orpc";
import {
  useAutomacao,
  useExecucoes,
  useLigarAutomacao,
  useSalvarGrafo,
} from "../hooks/use-automacoes";
import {
  CAMPOS_DO_FILTRO,
  OPERADORES_DO_FILTRO,
  PASSOS,
  rotuloDoNo,
  TEMPERATURAS,
} from "../lib/catalogo-de-nos";

type Passo = {
  id: string;
  type: CrmNodeType;
  name: string;
  data: Record<string, unknown>;
};

let contador = 0;
const novoId = () => `novo-${contador++}`;

export function AutomacaoEditor({ workflowId }: { workflowId: string }) {
  const { data: automacao, isLoading } = useAutomacao(workflowId);

  if (isLoading || !automacao) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando automação…
      </div>
    );
  }

  const gatilho = automacao.nos.find((no) => no.type.startsWith("TRIGGER_"));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{automacao.name}</p>
            <p className="truncate text-muted-foreground text-xs">
              {gatilho ? rotuloDoNo(gatilho.type) : "Sem gatilho"}
            </p>
          </div>
          <Ligar
            workflowId={workflowId}
            ligada={automacao.isActive}
            impedimento={automacao.problemas[0]?.mensagem ?? null}
          />
        </CardContent>
      </Card>

      {automacao.problemas.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <ul className="list-inside list-disc">
              {automacao.problemas.map((problema) => (
                <li key={`${problema.codigo}-${problema.nodeId ?? ""}`}>
                  {problema.mensagem}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="passos">
        <TabsList>
          <TabsTrigger value="passos">Passos</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções</TabsTrigger>
        </TabsList>

        <TabsContent value="passos" className="mt-4">
          <Passos
            workflowId={workflowId}
            funnelId={automacao.funnelId}
            gatilho={gatilho}
            nos={automacao.nos}
            arestas={automacao.arestas}
          />
        </TabsContent>

        <TabsContent value="execucoes" className="mt-4">
          <Execucoes workflowId={workflowId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Ligar({
  workflowId,
  ligada,
  impedimento,
}: {
  workflowId: string;
  ligada: boolean;
  impedimento: string | null;
}) {
  const ligar = useLigarAutomacao();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="automacao-ativa"
        checked={ligada}
        disabled={ligar.isPending || (!ligada && Boolean(impedimento))}
        onCheckedChange={(valor) =>
          ligar.mutate({ workflowId, isActive: valor })
        }
      />
      <label htmlFor="automacao-ativa" className="text-sm">
        {ligada ? "Ligada" : "Desligada"}
      </label>
    </div>
  );
}

/**
 * Os passos, em fila.
 *
 * O modelo no banco é um grafo, mas o editor monta só a fila: gatilho → passo
 * → passo. O "Só continuar se…" ocupa o lugar da bifurcação — quando a
 * condição não bate, a automação para ali. É o desenho que cobre quase tudo
 * que uma loja automatiza, e o dia que virar canvas os dados já estão no
 * formato certo.
 */
function Passos({
  workflowId,
  funnelId,
  gatilho,
  nos,
  arestas,
}: {
  workflowId: string;
  funnelId: string;
  gatilho:
    | {
        id: string;
        type: CrmNodeType;
        name: string;
        data: Record<string, unknown>;
      }
    | undefined;
  nos: {
    id: string;
    type: CrmNodeType;
    name: string;
    position: Record<string, number>;
    data: Record<string, unknown>;
  }[];
  arestas: { fromNodeId: string; toNodeId: string; fromOutput: string }[];
}) {
  const [passos, setPassos] = useState<Passo[]>(() =>
    emFila(nos, arestas, gatilho?.id),
  );
  const salvar = useSalvarGrafo();

  useEffect(() => {
    setPassos(emFila(nos, arestas, gatilho?.id));
  }, [nos, arestas, gatilho?.id]);

  const gravados = emFila(nos, arestas, gatilho?.id);
  const alterado = JSON.stringify(passos) !== JSON.stringify(gravados);

  function mexer(id: string, mudanca: (passo: Passo) => Passo) {
    setPassos((atual) =>
      atual.map((passo) => (passo.id === id ? mudanca(passo) : passo)),
    );
  }

  function gravar() {
    if (!gatilho) return;
    const todos = [
      {
        id: gatilho.id,
        type: gatilho.type,
        name: gatilho.name,
        position: { x: 0, y: 0 },
        data: gatilho.data,
      },
      ...passos.map((passo, indice) => ({
        id: passo.id,
        type: passo.type,
        name: passo.name,
        position: { x: 0, y: (indice + 1) * 120 },
        data: passo.data,
      })),
    ];

    const ligacoes = todos.slice(0, -1).map((no, indice) => ({
      fromNodeId: no.id,
      toNodeId: todos[indice + 1].id,
      // O filtro só continua pelo "sim" — o "não" é o fim do caminho.
      fromOutput: no.type === "FILTER" ? "sim" : "main",
    }));

    salvar.mutate({ workflowId, nos: todos, arestas: ligacoes });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!alterado || salvar.isPending}
          onClick={gravar}
        >
          {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar
        </Button>
      </div>

      <Card className="border-primary/40">
        <CardContent className="flex items-center gap-3 p-4">
          <Zap className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-medium text-sm">
              {gatilho ? rotuloDoNo(gatilho.type) : "Sem gatilho"}
            </p>
            {gatilho?.type === "TRIGGER_LEAD_IDLE" && (
              <p className="text-muted-foreground text-xs">
                Depois de {String(gatilho.data.minutos ?? "?")} minutos em
                silêncio.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {passos.map((passo, indice) => (
        <div key={passo.id} className="flex flex-col gap-3">
          <ArrowDown className="mx-auto size-4 text-muted-foreground" />
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">
                {indice + 1}. {rotuloDoNo(passo.type)}
              </CardTitle>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remover passo"
                onClick={() =>
                  setPassos((atual) => atual.filter((p) => p.id !== passo.id))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ConfiguracaoDoPasso
                passo={passo}
                funnelId={funnelId}
                onChange={(data) => mexer(passo.id, (p) => ({ ...p, data }))}
              />
            </CardContent>
          </Card>
        </div>
      ))}

      <ArrowDown className="mx-auto size-4 text-muted-foreground" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="size-4" />
            Adicionar passo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80">
          {PASSOS.map((item) => (
            <DropdownMenuItem
              key={item.tipo}
              className="flex flex-col items-start gap-0.5"
              onClick={() =>
                setPassos((atual) => [
                  ...atual,
                  {
                    id: novoId(),
                    type: item.tipo,
                    name: item.rotulo,
                    data: {},
                  },
                ])
              }
            >
              <span className="font-medium">{item.rotulo}</span>
              <span className="text-muted-foreground text-xs">
                {item.descricao}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Reconstrói a fila a partir do grafo, andando pelas ligações. */
function emFila(
  nos: {
    id: string;
    type: CrmNodeType;
    name: string;
    data: Record<string, unknown>;
  }[],
  arestas: { fromNodeId: string; toNodeId: string; fromOutput: string }[],
  gatilhoId: string | undefined,
): Passo[] {
  if (!gatilhoId) return [];
  const porId = new Map(nos.map((no) => [no.id, no]));
  const fila: Passo[] = [];

  let atual = gatilhoId;
  const vistos = new Set([gatilhoId]);

  while (fila.length < 50) {
    const proxima = arestas.find((aresta) => aresta.fromNodeId === atual);
    if (!proxima) break;
    const no = porId.get(proxima.toNodeId);
    if (!no || vistos.has(no.id)) break;

    vistos.add(no.id);
    fila.push({ id: no.id, type: no.type, name: no.name, data: no.data });
    atual = no.id;
  }

  return fila;
}

function ConfiguracaoDoPasso({
  passo,
  funnelId,
  onChange,
}: {
  passo: Passo;
  funnelId: string;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const { data: etapas } = useQuery(
    orpc.crm.stage.list.queryOptions({
      input: { funnelId },
      enabled: passo.type === "MOVE_STAGE",
    }),
  );
  const { data: membros } = useQuery(
    orpc.members.list.queryOptions({
      input: {},
      enabled: passo.type === "SET_RESPONSIBLE",
    }),
  );

  const troca = (campo: string, valor: unknown) =>
    onChange({ ...passo.data, [campo]: valor });

  switch (passo.type) {
    case "SEND_MESSAGE":
      return (
        <div className="flex flex-col gap-1">
          <Textarea
            rows={3}
            placeholder="Oi {{primeiro_nome}}, vi que você perguntou sobre…"
            value={String(passo.data.texto ?? "")}
            onChange={(e) => troca("texto", e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {"{{nome}}"} e {"{{primeiro_nome}}"} são trocados pelo nome do
            contato. Só sai se a janela de 24 horas estiver aberta.
          </p>
        </div>
      );

    case "WAIT":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            className="w-28"
            value={String(passo.data.minutos ?? "")}
            onChange={(e) => troca("minutos", Number(e.target.value))}
          />
          <span className="text-muted-foreground text-sm">minutos</span>
        </div>
      );

    case "MOVE_STAGE":
      return (
        <Select
          value={String(passo.data.stageId ?? "")}
          onValueChange={(valor) => troca("stageId", valor)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha a etapa" />
          </SelectTrigger>
          <SelectContent>
            {(etapas?.etapas ?? []).map((etapa) => (
              <SelectItem key={etapa.id} value={etapa.id}>
                {etapa.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "SET_TEMPERATURE":
      return (
        <Select
          value={String(passo.data.temperatura ?? "")}
          onValueChange={(valor) => troca("temperatura", valor)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha a temperatura" />
          </SelectTrigger>
          <SelectContent>
            {TEMPERATURAS.map((item) => (
              <SelectItem key={item.valor} value={item.valor}>
                {item.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "SET_RESPONSIBLE":
      return (
        <Select
          value={String(passo.data.userId ?? "")}
          onValueChange={(valor) => troca("userId", valor)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha quem atende" />
          </SelectTrigger>
          <SelectContent>
            {(membros ?? []).map((membro) => (
              <SelectItem key={membro.userId} value={membro.userId}>
                {membro.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "SET_WIN_LOSS":
      return (
        <Select
          value={String(passo.data.resultado ?? "")}
          onValueChange={(valor) => troca("resultado", valor)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Ganho ou perda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WON">Ganho</SelectItem>
            <SelectItem value="LOST">Perda</SelectItem>
          </SelectContent>
        </Select>
      );

    case "HTTP_REQUEST":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Select
              value={String(passo.data.metodo ?? "POST")}
              onValueChange={(valor) => troca("metodo", valor)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="https://…"
              value={String(passo.data.url ?? "")}
              onChange={(e) => troca("url", e.target.value)}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Endereços de rede interna são recusados.
          </p>
        </div>
      );

    case "FILTER":
      return <Filtro passo={passo} onChange={onChange} />;

    default:
      return null;
  }
}

function Filtro({
  passo,
  onChange,
}: {
  passo: Passo;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const condicao = (passo.data.condicao ?? {}) as {
    campo?: string;
    operador?: string;
    valor?: string;
  };

  const troca = (campo: string, valor: string) =>
    onChange({ condicao: { ...condicao, [campo]: valor } });

  const semValor =
    condicao.operador === "existe" || condicao.operador === "nao_existe";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={condicao.campo ?? ""}
        onValueChange={(v) => troca("campo", v)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="O quê" />
        </SelectTrigger>
        <SelectContent>
          {CAMPOS_DO_FILTRO.map((item) => (
            <SelectItem key={item.valor} value={item.valor}>
              {item.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condicao.operador ?? ""}
        onValueChange={(v) => troca("operador", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Como" />
        </SelectTrigger>
        <SelectContent>
          {OPERADORES_DO_FILTRO.map((item) => (
            <SelectItem key={item.valor} value={item.valor}>
              {item.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!semValor && (
        <Input
          className="w-48"
          placeholder="valor"
          value={condicao.valor ?? ""}
          onChange={(e) => troca("valor", e.target.value)}
        />
      )}
    </div>
  );
}

const COR_DO_STATUS: Record<string, "default" | "secondary" | "destructive"> = {
  SUCCESS: "default",
  RUNNING: "secondary",
  FILTERED: "secondary",
  RATE_LIMITED: "secondary",
  FAILED: "destructive",
};

const NOME_DO_STATUS: Record<string, string> = {
  SUCCESS: "Concluída",
  RUNNING: "Rodando",
  FILTERED: "Parou no caminho",
  RATE_LIMITED: "Limite por hora",
  FAILED: "Falhou",
};

function Execucoes({ workflowId }: { workflowId: string }) {
  const { data, isLoading } = useExecucoes(workflowId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando…
      </div>
    );
  }

  const execucoes = data?.execucoes ?? [];

  return (
    <Card>
      <CardContent className="p-4">
        {execucoes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ainda não rodou nenhuma vez.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {execucoes.map((execucao) => (
              <div key={execucao.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-sm">
                    {execucao.leadNome ?? "Sem contato"}
                  </span>
                  <Badge
                    variant={COR_DO_STATUS[execucao.status] ?? "secondary"}
                  >
                    {NOME_DO_STATUS[execucao.status] ?? execucao.status}
                  </Badge>
                </div>
                <span className="text-muted-foreground text-xs">
                  {format(new Date(execucao.iniciadaEm), "dd/MM 'às' HH:mm", {
                    locale: ptBR,
                  })}{" "}
                  · {execucao.passos}{" "}
                  {execucao.passos === 1 ? "passo" : "passos"}
                </span>
                {execucao.erro && (
                  <span className="text-destructive text-xs">
                    {execucao.erro}
                  </span>
                )}
                {execucao.etapas.length > 0 && (
                  <ol className="mt-1 flex flex-col gap-0.5 text-muted-foreground text-xs">
                    {execucao.etapas.map((etapa, indice) => (
                      <li key={indice}>
                        {etapa.status === "FAILED" ? "✕" : "•"} {etapa.no}
                        {etapa.erro ? ` — ${etapa.erro}` : ""}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
