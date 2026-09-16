"use client";

import type { AstroCamada, AstroEstado, Movimento } from "@nerp/site-content";
import { podeSeguir } from "@nerp/site-content";
import {
  ArrowLeftRight,
  ChevronDown,
  FlipHorizontal2,
  FlipVertical2,
  Link2,
  Link2Off,
  Spline,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CORES_DE_FUNDO,
  ehBoca,
  ehLuva,
  ehOlho,
  ladoDoOlho,
  type LuvaDoCatalogo,
  type ModeloDeOlho,
  type ModeloDePeca,
  type Pecas,
  srcDoOlho,
} from "../../lib/astro-catalogo";
import { Movimentos } from "./movimentos";
import { Suavizacoes } from "./suavizacoes";

export type Modo = "ini" | "fim";

/**
 * A coluna da direita: tudo o que a camada selecionada sabe fazer.
 *
 * O par Início/Fim no topo não é decoração — é o que decide onde os campos
 * abaixo escrevem. Sem ele o painel precisaria de duas colunas iguais, e
 * ninguém acerta de primeira qual delas está mexendo.
 */
export function Propriedades({
  camada,
  modo,
  luvas,
  pecas,
  aoTrocarModo,
  aoMudarEstado,
  aoMudarCamada,
  aoTrocarLuva,
  aoTrocarOlho,
  aoTrocarBoca,
  aoTrocarFundo,
  aoAplicarMovimento,
  camadas,
  aoVincular,
}: {
  camada: AstroCamada | null;
  modo: Modo;
  luvas: LuvaDoCatalogo[];
  pecas: Pecas | null;
  aoTrocarModo: (m: Modo) => void;
  aoMudarEstado: (t: Partial<AstroEstado>) => void;
  aoMudarCamada: (t: Partial<AstroCamada>) => void;
  aoTrocarLuva: (l: LuvaDoCatalogo) => void;
  aoTrocarOlho: (m: ModeloDeOlho) => void;
  aoTrocarBoca: (m: ModeloDePeca) => void;
  aoTrocarFundo: (m: ModeloDePeca) => void;
  aoAplicarMovimento: (m: Movimento) => void;
  /** a cena inteira: o vínculo é uma relação entre camadas, não um campo solto */
  camadas: AstroCamada[];
  aoVincular: (seguidorId: string, lider: string | null) => void;
}) {
  if (!camada) {
    return (
      <section className="flex min-h-0 items-center justify-center border-l bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">
          Escolha uma camada no palco ou na lista.
        </p>
      </section>
    );
  }

  const e = camada[modo];
  const lider = camada.vinculo
    ? (camadas.find((c) => c.id === camada.vinculo) ?? null)
    : null;
  // Quem já segue outro não entra na lista: uma camada tem um líder só, e um
  // ciclo é movimento sem origem.
  const candidatos = camadas.filter(
    (c) =>
      c.id !== camada.id &&
      podeSeguir(camadas, c.id, camada.id) &&
      (!c.vinculo || c.vinculo === camada.id),
  );

  return (
    <section className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l bg-card p-3">
      <h2 className="truncate text-sm font-medium">{camada.nome}</h2>

      {/*
        O modelo fica no TOPO porque é a IDENTIDADE da camada — que mão, que
        olho, que boca — e não um ajuste fino como posição ou duração. Num
        popover, e não numa grade aberta: são 48 luvas, 12 olhos, 9 bocas e 6
        fundos, e abertos empurrariam todo o resto do painel para fora da tela.
      */}
      {ehLuva(camada) && luvas.length > 0 && (
        <SeletorDeModelo
          rotulo="Modelo da mão"
          atual={camada.src}
          colunas={6}
          opcoes={luvas.map((l) => ({
            chave: String(l.id),
            nome: `Modelo ${l.id}`,
            src: l.src,
            escolher: () => aoTrocarLuva(l),
          }))}
        />
      )}

      {ehOlho(camada) && pecas && (
        <SeletorDeModelo
          rotulo="Modelo do olho"
          atual={camada.src}
          colunas={4}
          opcoes={pecas.olhos.map((o) => ({
            chave: o.id,
            nome: o.nome,
            // Cada lado tem o seu recorte: a miniatura mostra o do olho que
            // está selecionado, senão o painel do olho direito ofereceria o
            // desenho do esquerdo.
            src: srcDoOlho(o, ladoDoOlho(camada)),
            escolher: () => aoTrocarOlho(o),
          }))}
        />
      )}

      {ehBoca(camada) && pecas && (
        <SeletorDeModelo
          rotulo="Modelo da boca"
          atual={camada.src}
          colunas={3}
          opcoes={pecas.bocas.map((b) => ({
            chave: b.id,
            nome: b.nome,
            src: b.src,
            escolher: () => aoTrocarBoca(b),
          }))}
        />
      )}

      {camada.tipo === "cor" && (
        <div className="flex flex-col gap-2">
          {pecas && pecas.fundos.length > 0 && (
            <div className="grid grid-cols-3 gap-1">
              {pecas.fundos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  title={f.nome}
                  aria-label={f.nome}
                  onClick={() => aoTrocarFundo(f)}
                  className={cn(
                    "aspect-video overflow-hidden rounded-md border-2 transition-colors",
                    camada.src === f.src ? "border-primary" : "border-border",
                  )}
                >
                  {/* biome-ignore lint/performance/noImgElement: miniatura vinda do /public, sem otimização a fazer */}
                  <img
                    src={f.src}
                    alt={f.nome}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/*
            As cores lisas limpam o `src`: fundo é ou imagem ou cor, e deixar a
            imagem por baixo faria clicar numa cor não mudar nada.
          */}
          <div className="grid grid-cols-6 gap-1">
            {CORES_DE_FUNDO.map((f) => (
              <button
                key={f.cor}
                type="button"
                title={f.nome}
                aria-label={f.nome}
                onClick={() => aoMudarCamada({ cor: f.cor, src: "" })}
                className={cn(
                  "aspect-square rounded-md border-2 transition-colors",
                  // O xadrez atrás do transparente: um quadrado vazio pareceria
                  // branco, que é justamente outra das opções da fileira.
                  f.cor === "transparent" &&
                    "bg-[length:8px_8px] bg-[linear-gradient(45deg,#bbb_25%,transparent_25%,transparent_75%,#bbb_75%),linear-gradient(45deg,#bbb_25%,transparent_25%,transparent_75%,#bbb_75%)] bg-[position:0_0,4px_4px]",
                  !camada.src && camada.cor === f.cor
                    ? "border-primary"
                    : "border-border",
                )}
                style={
                  f.cor === "transparent" ? undefined : { background: f.cor }
                }
              />
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="color"
              value={
                camada.cor.startsWith("#") ? camada.cor : CORES_DE_FUNDO[0].cor
              }
              onChange={(ev) =>
                aoMudarCamada({ cor: ev.target.value, src: "" })
              }
              className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0.5"
            />
            Outra cor
          </label>
        </div>
      )}

      {/*
        Espelhar dobra o que a arte oferece sem inventar desenho: a mesma luva
        vira a mão do outro lado, e o sorriso de cabeça para baixo é a boca
        triste que não existe como arquivo. Fora do fundo, que é um retângulo
        de cor e não espelha nada.
      */}
      {camada.tipo !== "cor" && (
        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            size="sm"
            variant={camada.espelhoX ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => aoMudarCamada({ espelhoX: !camada.espelhoX })}
          >
            <FlipHorizontal2 className="size-3.5" />
            Espelhar
          </Button>
          <Button
            type="button"
            size="sm"
            variant={camada.espelhoY ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => aoMudarCamada({ espelhoY: !camada.espelhoY })}
          >
            <FlipVertical2 className="size-3.5" />
            Virar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["ini", "fim"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => aoTrocarModo(m)}
            className={cn(
              "rounded-md py-1.5 text-xs font-medium transition-colors",
              modo === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "ini" ? "Início" : "Fim"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Numero
          rotulo="Posição X"
          valor={Math.round(e.x)}
          aoMudar={(v) => aoMudarEstado({ x: v })}
        />
        <Numero
          rotulo="Posição Y"
          valor={Math.round(e.y)}
          aoMudar={(v) => aoMudarEstado({ y: v })}
        />
        <Numero
          rotulo="Rotação °"
          valor={Math.round(e.rot)}
          aoMudar={(v) => aoMudarEstado({ rot: v })}
        />
        <Numero
          rotulo="Escala"
          valor={e.esc}
          passo={0.05}
          min={0.01}
          aoMudar={(v) => aoMudarEstado({ esc: v })}
        />
        <Numero
          rotulo="Opacidade"
          valor={e.op}
          passo={0.05}
          min={0}
          max={1}
          aoMudar={(v) => aoMudarEstado({ op: v })}
        />
        <div className="flex flex-col justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              aoMudarCamada(
                modo === "ini"
                  ? { fim: { ...camada.ini } }
                  : { ini: { ...camada.fim } },
              )
            }
          >
            <ArrowLeftRight className="size-3.5" />
            {modo === "ini" ? "Copiar p/ fim" : "Copiar p/ início"}
          </Button>
        </div>
      </div>

      {camada.tipo === "texto" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="anim-texto" className="text-xs">
            Texto do balão
          </Label>
          <Input
            id="anim-texto"
            value={camada.texto}
            onChange={(ev) => aoMudarCamada({ texto: ev.target.value })}
          />
        </div>
      )}

      {/*
        Camada vinculada não tem movimento próprio: ele vem do líder. Deixar
        os campos aqui seria oferecer uma edição que a próxima sincronização
        apagaria — e o que continua dela é a POSIÇÃO, porque o vínculo copia
        o gesto, não o lugar.
      */}
      {!lider && (
        <>
          <Separator />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Movimento
          </h2>

          {/*
          O tipo de movimento vem ANTES dos números porque é o caminho curto:
          escolher "flutuar" preenche duração, suavização e repetição de uma vez.
          Os campos abaixo continuam mandando — o preset escreve neles e sai de
          cena, sem ficar guardado como um rótulo que envelhece.
        */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start gap-1.5"
              >
                <Wand2 className="size-3.5" />
                <span className="flex-1 text-left">Tipo de movimento</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <Movimentos aoEscolher={aoAplicarMovimento} />
            </PopoverContent>
          </Popover>

          <div className="grid grid-cols-2 gap-2">
            <Numero
              rotulo="Duração s"
              valor={camada.duracao}
              passo={0.1}
              min={0}
              aoMudar={(v) => aoMudarCamada({ duracao: v })}
            />
            <Numero
              rotulo="Atraso s"
              valor={camada.atraso}
              passo={0.1}
              min={0}
              aoMudar={(v) => aoMudarCamada({ atraso: v })}
            />
            <Numero
              rotulo="Intervalo s"
              valor={camada.intervalo}
              passo={0.1}
              min={0}
              aoMudar={(v) => aoMudarCamada({ intervalo: v })}
            />
            <p className="self-end pb-2 text-[11px] leading-tight text-muted-foreground">
              descanso entre uma repetição e a seguinte
            </p>
          </div>

          {/*
          A suavização é escolhida vendo, não lendo: `power2.inOut` e `back.out`
          não dizem nada a quem não escreve código, e uma bola que acelera e freia
          diz tudo. O nome fica no gatilho, para quem já sabe o que procura.
        */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Suavização</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-1.5 font-mono text-[11px]"
                >
                  <Spline className="size-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate text-left">
                    {camada.easing}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2">
                <Suavizacoes
                  atual={camada.easing}
                  aoEscolher={(easing) => aoMudarCamada({ easing })}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 items-end gap-2">
            <Numero
              rotulo="Repetições"
              valor={camada.repete}
              passo={1}
              min={-1}
              aoMudar={(v) => aoMudarCamada({ repete: Math.round(v) })}
            />
            <div className="flex items-center justify-between gap-2 pb-2">
              <Label htmlFor="anim-vaivem" className="text-xs font-normal">
                Vai e volta
              </Label>
              <Switch
                id="anim-vaivem"
                checked={camada.vaivem}
                onCheckedChange={(v) => aoMudarCamada({ vaivem: v })}
              />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <b>-1</b> repete para sempre. Vai e volta faz o caminho de volta
            contar como um ciclo — com um número par de ciclos a camada termina
            onde começou.
          </p>
        </>
      )}

      {/*
        Camada vinculada não tem movimento próprio: ele vem do líder, e
        deixar os campos editáveis aqui seria oferecer uma edição que a
        próxima sincronização apagaria. O que continua dela é a POSIÇÃO —
        o vínculo copia o gesto, não o lugar.
      */}
      {lider ? (
        <>
          <Separator />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Vínculo
          </h2>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-xs">
              Acompanha <b className="font-medium">{lider.nome}</b>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="Desvincular"
              onClick={() => aoVincular(camada.id, null)}
            >
              <Link2Off className="size-3.5" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <Separator />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Vínculo
          </h2>
          {/*
            Marcar aqui não move nada de lugar: o seguidor passa a fazer o
            MESMO deslocamento a partir de onde ele está. Copiar o destino
            bruto o jogaria para cima desta camada.
          */}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Quem for marcado repete este movimento a partir do próprio lugar.
          </p>
          <div className="flex flex-col gap-0.5">
            {candidatos.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted"
              >
                <Checkbox
                  id={`vinculo-${c.id}`}
                  checked={c.vinculo === camada.id}
                  onCheckedChange={(v) =>
                    aoVincular(c.id, v ? camada.id : null)
                  }
                />
                <Label
                  htmlFor={`vinculo-${c.id}`}
                  className="min-w-0 flex-1 truncate text-xs font-normal"
                >
                  {c.nome}
                </Label>
              </div>
            ))}
            {candidatos.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Não há outra camada para vincular.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * O seletor de modelo — o mesmo para luva, olho e boca.
 *
 * O gatilho mostra a peça ATUAL em miniatura: é o que responde "qual está
 * escolhida?" sem abrir nada. As famílias só diferem em quantas colunas cabem,
 * porque as luvas são quadradas e as bocas são largas.
 */
function SeletorDeModelo({
  rotulo,
  atual,
  colunas,
  opcoes,
}: {
  rotulo: string;
  atual: string;
  colunas: 3 | 4 | 6;
  opcoes: {
    chave: string;
    nome: string;
    src: string;
    escolher: () => void;
  }[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto justify-start gap-2 py-1.5"
        >
          {/* biome-ignore lint/performance/noImgElement: miniatura de 28px vinda do /public, sem otimização a fazer */}
          <img src={atual} alt="" className="size-7 shrink-0 object-contain" />
          <span className="flex-1 text-left text-xs">{rotulo}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div
          className={cn(
            "grid max-h-72 gap-1 overflow-y-auto",
            colunas === 6 && "grid-cols-6",
            colunas === 4 && "grid-cols-4",
            colunas === 3 && "grid-cols-3",
          )}
        >
          {/*
            Ladrilho cinza médio, e não o branco do popover: as peças são arte
            BRANCA (olhos, luvas) e arte ESCURA (a boca aberta) no mesmo
            catálogo. Só um meio-termo deixa as duas visíveis — no branco os
            olhos somem, no escuro some a boca.
          */}
          {opcoes.map((o) => (
            <button
              key={o.chave}
              type="button"
              onClick={o.escolher}
              title={o.nome}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border bg-slate-400 p-1 transition-colors hover:border-primary",
                atual === o.src && "border-primary bg-accent",
              )}
            >
              {/*
                Sem `loading="lazy"`: as peças somam poucos KB no próprio
                /public, e adiar o carregamento dentro de um popover que rola
                abria a grade em branco — o contrário de escolher.
              */}
              {/* biome-ignore lint/performance/noImgElement: miniatura de 40px vinda do /public, sem otimização a fazer */}
              <img
                src={o.src}
                alt={o.nome}
                className="max-h-full max-w-full object-contain"
              />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Numero({
  rotulo,
  valor,
  aoMudar,
  passo = 1,
  min,
  max,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (v: number) => void;
  passo?: number;
  min?: number;
  max?: number;
}) {
  const id = `anim-${rotulo.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {rotulo}
      </Label>
      <Input
        id={id}
        type="number"
        value={valor}
        step={passo}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          // Campo em branco vira NaN e apagaria a posição da camada; ignorar
          // deixa o usuário limpar o campo para digitar de novo.
          if (!Number.isNaN(v)) aoMudar(v);
        }}
      />
    </div>
  );
}
