"use client";

import { useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { PainelDeMarketing } from "@/features/site/server/painel-de-marketing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useMarketingPainel } from "../hooks/use-site-admin";
import {
  PERIODO_PADRAO,
  SeletorDePeriodo,
  desde,
  rotuloDoPeriodo,
} from "./periodo-do-painel";
import { SiteMarketingConversao } from "./site-marketing-conversao";
import { SiteMarketingPixels } from "./site-marketing-pixels";
import { SitePageHeader } from "./site-page-header";

/**
 * A aba Marketing: de onde vem quem visita o site, o que lê, quanto fica e
 * quantos viram lead. As definições de cada número estão no servidor
 * (`painel-de-marketing.ts`) e repetidas nas legendas, para ninguém comparar
 * esta rejeição com a de outra ferramenta achando que é a mesma conta.
 */
export function SiteMarketing() {
  const [dias, setDias] = useState<number>(PERIODO_PADRAO);
  const [aba, setAba] = useState("metricas");
  const { painel, isLoading, isFetching } = useMarketingPainel(dias);

  return (
    <div className="flex flex-col gap-6">
      <SitePageHeader
        title="Marketing"
        description="Visitas, páginas, origens e conversão do site — o aviso de saída, a barra fixa e os pixels de anúncio."
      />

      <Tabs value={aba} onValueChange={setAba} className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
            <TabsTrigger value="conversao">Conversão</TabsTrigger>
            <TabsTrigger value="pixels">Pixels e tags</TabsTrigger>
          </TabsList>
          {aba === "metricas" && (
            <SeletorDePeriodo dias={dias} onChange={setDias} />
          )}
        </div>

        <TabsContent
          value="metricas"
          className={cn(
            "flex flex-col gap-6 transition-opacity",
            isFetching && !isLoading && "opacity-60",
          )}
        >
          {isLoading || !painel ? (
            <CarregandoPainel />
          ) : (
            <Metricas painel={painel} />
          )}
        </TabsContent>

        <TabsContent value="conversao">
          <SiteMarketingConversao />
        </TabsContent>

        <TabsContent value="pixels">
          <SiteMarketingPixels />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CarregandoPainel() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-80" />
    </>
  );
}

function Metricas({ painel }: { painel: PainelDeMarketing }) {
  const { resumo } = painel;

  if (resumo.visitas === 0 && resumo.leads === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-10 text-center">
          <p className="font-medium">
            Nenhuma visita medida nos {rotuloDoPeriodo(painel.dias)}.
          </p>
          <p className="text-sm text-muted-foreground">
            A contagem começa quando o site com o medidor estiver no ar. Visitas
            de robôs e de quem abre o site com <code>?nao-medir=1</code> não
            entram.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Visitantes"
          valor={numero(resumo.visitantes)}
          detalhe={`${numero(resumo.visitantesNovos)} novos`}
        />
        <Indicador
          titulo="Visitas"
          valor={numero(resumo.visitas)}
          detalhe={`${razao(resumo.paginasVistas, resumo.visitas)} páginas por visita`}
        />
        <Indicador
          titulo="Tempo médio da visita"
          valor={duracao(resumo.duracaoMedia)}
          detalhe={`${duracao(resumo.tempoMedioPorPagina)} por página`}
        />
        <Indicador
          titulo="Taxa de rejeição"
          valor={percentual(resumo.rejeicoes, resumo.visitas)}
          detalhe="1 página, menos de 10s e sem conversa"
        />
        <Indicador
          titulo="Páginas vistas"
          valor={numero(resumo.paginasVistas)}
        />
        <Indicador
          titulo="Conversas com o Astro"
          valor={numero(resumo.conversas)}
          detalhe={`${percentual(resumo.conversas, resumo.visitas)} das visitas`}
        />
        <Indicador
          titulo="Leads"
          valor={numero(resumo.leads)}
          detalhe={
            resumo.leads > resumo.leadsRastreados
              ? `${numero(resumo.leadsRastreados)} com origem conhecida`
              : "diagnósticos registrados pelo Astro"
          }
        />
        <Indicador
          titulo="Conversão"
          valor={percentual(resumo.leads, resumo.visitas)}
          detalhe="leads ÷ visitas"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GraficoDeVisitas serie={painel.serie} />
        <GraficoDeLeads serie={painel.serie} />
      </div>

      <TabelaDePaginas paginas={painel.paginas} />

      <div className="grid gap-4 xl:grid-cols-2">
        <TabelaDeOrigens origens={painel.origens} />
        <TabelaDeCampanhas campanhas={painel.campanhas} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Dispositivos
          dispositivos={painel.dispositivos}
          total={resumo.visitas}
        />
        <FunilDeScroll scroll={painel.scroll} />
        <Cliques cliques={painel.cliques} />
      </div>

      <LeadsRecentes leads={painel.leadsRecentes} />
    </>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-sm text-muted-foreground">{titulo}</span>
        <span className="text-2xl font-semibold tabular-nums">{valor}</span>
        {detalhe && (
          <span className="text-xs text-muted-foreground">{detalhe}</span>
        )}
      </CardContent>
    </Card>
  );
}

function Secao({
  titulo,
  descricao,
  className,
  children,
}: {
  titulo: string;
  descricao?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descricao && (
          <p className="text-sm text-muted-foreground">{descricao}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const CONFIG_VISITAS: ChartConfig = {
  visitas: { label: "Visitas", color: "var(--chart-1)" },
};
const CONFIG_LEADS: ChartConfig = {
  leads: { label: "Leads", color: "var(--chart-2)" },
};

/** "2026-09-14" → "14/09". A série já vem no fuso do site. */
const rotuloDoDia = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

// Visitas e leads ficam em gráficos separados, não num eixo duplo: a escala
// de um esmagaria o outro, e dois eixos no mesmo quadro induzem correlação.
function GraficoDeVisitas({ serie }: { serie: PainelDeMarketing["serie"] }) {
  return (
    <Secao titulo="Visitas por dia" className="lg:col-span-2">
      <ChartContainer config={CONFIG_VISITAS} className="h-56 w-full">
        <AreaChart data={serie} margin={{ left: 4, right: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="dia"
            tickFormatter={rotuloDoDia}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, itens) =>
                  rotuloDoDia(String(itens[0]?.payload?.dia ?? ""))
                }
              />
            }
          />
          <Area
            dataKey="visitas"
            type="monotone"
            stroke="var(--color-visitas)"
            fill="var(--color-visitas)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </Secao>
  );
}

function GraficoDeLeads({ serie }: { serie: PainelDeMarketing["serie"] }) {
  return (
    <Secao titulo="Leads por dia">
      <ChartContainer config={CONFIG_LEADS} className="h-56 w-full">
        <BarChart data={serie} margin={{ left: 4, right: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="dia"
            tickFormatter={rotuloDoDia}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, itens) =>
                  rotuloDoDia(String(itens[0]?.payload?.dia ?? ""))
                }
              />
            }
          />
          <Bar
            dataKey="leads"
            fill="var(--color-leads)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </Secao>
  );
}

function TabelaDePaginas({
  paginas,
}: {
  paginas: PainelDeMarketing["paginas"];
}) {
  return (
    <Secao
      titulo="Páginas mais acessadas"
      descricao="Tempo ativo é o tempo com a aba à frente e alguém mexendo. Saída: das vezes que a página foi vista, em quantas a visita terminou nela."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Página</TableHead>
            <TableHead className="text-right">Visualizações</TableHead>
            <TableHead className="text-right">Visitantes</TableHead>
            <TableHead className="text-right">Tempo ativo</TableHead>
            <TableHead className="text-right">Scroll médio</TableHead>
            <TableHead className="text-right">Entradas</TableHead>
            <TableHead className="text-right">Taxa de saída</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginas.length === 0 && <LinhaVazia colunas={7} />}
          {paginas.map((pagina) => (
            <TableRow key={pagina.path}>
              <TableCell className="max-w-72">
                <div className="flex flex-col">
                  <span className="truncate font-medium">
                    {pagina.titulo || pagina.path}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {pagina.path}
                  </span>
                </div>
              </TableCell>
              <Numero valor={numero(pagina.visualizacoes)} />
              <Numero valor={numero(pagina.visitantes)} />
              <Numero valor={duracao(pagina.tempoMedio)} />
              <Numero valor={`${pagina.scrollMedio}%`} />
              <Numero valor={numero(pagina.entradas)} />
              <Numero valor={percentual(pagina.saidas, pagina.visualizacoes)} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Secao>
  );
}

function TabelaDeOrigens({
  origens,
}: {
  origens: PainelDeMarketing["origens"];
}) {
  return (
    <Secao
      titulo="Origem do tráfego"
      descricao="A utm_source da chegada; sem ela, o site que mandou o visitante."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Visitas</TableHead>
            <TableHead className="text-right">Rejeição</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Conversão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {origens.length === 0 && <LinhaVazia colunas={5} />}
          {origens.map((linha) => (
            <TableRow key={linha.origem}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{linha.origem}</span>
                  <Badge variant="outline" className="font-normal">
                    {linha.meio}
                  </Badge>
                </div>
              </TableCell>
              <Numero valor={numero(linha.visitas)} />
              <Numero valor={percentual(linha.rejeicoes, linha.visitas)} />
              <Numero valor={numero(linha.leads)} />
              <Numero valor={percentual(linha.leads, linha.visitas)} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Secao>
  );
}

function TabelaDeCampanhas({
  campanhas,
}: {
  campanhas: PainelDeMarketing["campanhas"];
}) {
  return (
    <Secao
      titulo="Campanhas (UTM)"
      descricao="Links com utm_campaign — os anúncios que trouxeram gente."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campanha</TableHead>
            <TableHead className="text-right">Visitas</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Conversão</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campanhas.length === 0 && (
            <LinhaVazia
              colunas={4}
              texto="Nenhuma visita chegou por link com utm_campaign."
            />
          )}
          {campanhas.map((linha) => (
            <TableRow key={linha.campanha}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="truncate font-medium">{linha.campanha}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[linha.origem, linha.meio].filter(Boolean).join(" / ")}
                  </span>
                </div>
              </TableCell>
              <Numero valor={numero(linha.visitas)} />
              <Numero valor={numero(linha.leads)} />
              <Numero valor={percentual(linha.leads, linha.visitas)} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Secao>
  );
}

const NOME_DO_DISPOSITIVO: Record<string, string> = {
  desktop: "Computador",
  tablet: "Tablet",
  mobile: "Celular",
};

function Dispositivos({
  dispositivos,
  total,
}: {
  dispositivos: PainelDeMarketing["dispositivos"];
  total: number;
}) {
  return (
    <Secao titulo="Dispositivos">
      <div className="flex flex-col gap-4">
        {dispositivos.map((linha) => (
          <Medidor
            key={linha.dispositivo}
            rotulo={NOME_DO_DISPOSITIVO[linha.dispositivo] ?? linha.dispositivo}
            valor={linha.visitas}
            total={total}
            detalhe={`${percentual(linha.rejeicoes, linha.visitas)} de rejeição`}
          />
        ))}
      </div>
    </Secao>
  );
}

function FunilDeScroll({ scroll }: { scroll: PainelDeMarketing["scroll"] }) {
  const marcas = [
    { rotulo: "25% da página", valor: scroll.p25 },
    { rotulo: "Metade", valor: scroll.p50 },
    { rotulo: "75% da página", valor: scroll.p75 },
    { rotulo: "Chegaram ao fim", valor: scroll.p100 },
  ];
  return (
    <Secao
      titulo="Profundidade de leitura"
      descricao="Das páginas vistas, quantas foram roladas até cada ponto."
    >
      <div className="flex flex-col gap-4">
        {marcas.map((marca) => (
          <Medidor
            key={marca.rotulo}
            rotulo={marca.rotulo}
            valor={marca.valor}
            total={scroll.total}
          />
        ))}
      </div>
    </Secao>
  );
}

function Cliques({ cliques }: { cliques: PainelDeMarketing["cliques"] }) {
  return (
    <Secao
      titulo="Botões e links mais clicados"
      descricao="Pelo texto que o visitante viu."
    >
      {cliques.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum clique no período.
        </p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm">
          {cliques.map((clique) => (
            <li
              key={clique.rotulo}
              className="flex items-baseline justify-between gap-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{clique.rotulo}</span>
                {clique.destino && (
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {clique.destino}
                  </span>
                )}
              </div>
              <span className="shrink-0 tabular-nums">
                {numero(clique.cliques)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}

function LeadsRecentes({
  leads,
}: {
  leads: PainelDeMarketing["leadsRecentes"];
}) {
  return (
    <Secao
      titulo="Leads recentes e de onde vieram"
      descricao="Sem origem: a conversa aconteceu antes do medidor, ou num navegador que o bloqueou."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Campanha</TableHead>
            <TableHead>Entrou por</TableHead>
            <TableHead className="text-right">Quando</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 && <LinhaVazia colunas={5} />}
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{lead.nome}</span>
                  {lead.empresa && (
                    <span className="text-xs text-muted-foreground">
                      {lead.empresa}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{lead.origem ?? "—"}</TableCell>
              <TableCell>{lead.campanha ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">
                {lead.entrada ?? "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {desde(lead.criadoEm)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Secao>
  );
}

function Medidor({
  rotulo,
  valor,
  total,
  detalhe,
}: {
  rotulo: string;
  valor: number;
  total: number;
  detalhe?: string;
}) {
  const fracao = total > 0 ? Math.min(valor / total, 1) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{rotulo}</span>
        <span className="tabular-nums text-muted-foreground">
          {numero(valor)} · {percentual(valor, total)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--chart-1)]"
          style={{ width: `${fracao * 100}%` }}
        />
      </div>
      {detalhe && (
        <span className="text-xs text-muted-foreground">{detalhe}</span>
      )}
    </div>
  );
}

function Numero({ valor }: { valor: string }) {
  return <TableCell className="text-right tabular-nums">{valor}</TableCell>;
}

function LinhaVazia({
  colunas,
  texto = "Nada no período.",
}: {
  colunas: number;
  texto?: string;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colunas}
        className="py-6 text-center text-muted-foreground"
      >
        {texto}
      </TableCell>
    </TableRow>
  );
}

const formatoNumero = new Intl.NumberFormat("pt-BR");
const numero = (n: number) => formatoNumero.format(n);

function percentual(parte: number, total: number) {
  if (total <= 0) return "—";
  const valor = (parte / total) * 100;
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: valor < 10 ? 1 : 0 })}%`;
}

function razao(parte: number, total: number) {
  if (total <= 0) return "0";
  return (parte / total).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function duracao(segundos: number) {
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto ? `${minutos}m ${resto}s` : `${minutos}m`;
}
