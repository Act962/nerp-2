"use client";

import {
  ASTRO_VIEWBOX,
  type AstroAnimacao,
  type AstroCamada,
  type AstroEstado,
  cenaNova,
  duracaoReal,
  MOMENTOS,
  quadro,
  sincronizarVinculos,
  slugificarAnimacao,
} from "@nerp/site-content";
import { Download, FilePlus2, LayoutGrid, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { UploadError, uploadToR2 } from "@/lib/upload-to-r2";
import {
  useAbrirAstroAnimacao,
  useAstroAnimacoes,
  useExcluirAstroAnimacao,
  useSalvarAstroAnimacao,
} from "../../hooks/use-astro-animacao";
import {
  camadaDeBalao,
  camadaDeBocaNova,
  camadaDeBolaBranca,
  camadaDeGlobo,
  camadaDeImagem,
  camadaDeMaoNova,
  camadaDeObjeto,
  camadaDeOlhoNovo,
  carregarManifesto,
  carregarPecas,
  ehLuva,
  type LuvaDoCatalogo,
  type Manifesto,
  type ModeloDeOlho,
  type ModeloDePeca,
  montarAstro,
  type Pecas,
  trocaDeBoca,
  trocaDeOlho,
} from "../../lib/astro-catalogo";
import { useRegisterMedia } from "../../hooks/use-site-admin";
import { Adicionar, type PecaNova } from "./adicionar";
import { Camadas } from "./camadas";
import { Poses } from "./poses";
import { LinhaDoTempo } from "./linha-do-tempo";
import { type Modo, Propriedades } from "./propriedades";

/**
 * O editor de animações do ASTRO.
 *
 * O modelo mental é um só: cada camada tem um estado de INÍCIO e um de FIM, e
 * o botão do painel diz qual dos dois você está editando. Arrastar no palco,
 * girar pela alça ou digitar no campo — tudo escreve no mesmo lugar. Foi a
 * escolha que dispensou uma linha do tempo com keyframes: o que o site pede do
 * mascote é entrar, acenar, pulsar e sair, e isso cabe em dois estados.
 *
 * O que coloca uma cena no ar é o MOMENTO. Sem momento ela fica salva e
 * ninguém a vê — é o mesmo par rascunho/publicado das páginas do site.
 */

/** Konva lê o `window` ao carregar; no servidor não existe stage a montar. */
const Palco = dynamic(() => import("./palco").then((m) => m.Palco), {
  ssr: false,
  loading: () => <Spinner />,
});

const SEM_MOMENTO = "__nenhum";

export function AstroAnimacaoEditor() {
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [pecas, setPecas] = useState<Pecas | null>(null);
  /*
    "Sem título", e não um nome bonito: um padrão como "Aceno" colide com uma
    animação salva de mesmo nome, e salvar por cima dela passava despercebido —
    o cabeçalho mostrava "Aceno · rascunho" enquanto a lista mostrava "Aceno ·
    Widget parado", que são a cena nova e a gravada, não a mesma.
  */
  const [cena, setCena] = useState<AstroAnimacao>(() => cenaNova());
  const [sel, setSel] = useState("");
  const [modo, setModo] = useState<Modo>("ini");
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  /**
   * O slug com que a cena foi aberta ou salva pela última vez. O slug corrente
   * nasce do nome e muda a cada tecla; sem guardar o antigo, renomear salvaria
   * uma segunda animação e deixaria a original para trás.
   */
  const [slugSalvo, setSlugSalvo] = useState<string | null>(null);

  const area = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [escala, setEscala] = useState(0.25);

  const { animacoes } = useAstroAnimacoes();
  const salvar = useSalvarAstroAnimacao();
  const excluir = useExcluirAstroAnimacao();
  const abrir = useAbrirAstroAnimacao();
  const registrarMidia = useRegisterMedia();

  // --------------------------------------------------------------- montagem
  useEffect(() => {
    Promise.all([carregarManifesto(), carregarPecas()])
      .then(([m, p]) => {
        setManifesto(m);
        setPecas(p);
        setCena((c) => {
          // Só monta o ASTRO na cena virgem: quem já abriu uma animação salva
          // não quer um segundo mascote por cima.
          if (c.camadas.length > 1) return c;
          return { ...c, camadas: [...c.camadas, ...montarAstro(m, p)] };
        });
        setSel("mao_esq");
      })
      .catch(() => toast.error("Não consegui carregar as peças do ASTRO"));
  }, []);

  // O palco acompanha o espaço disponível, sem nunca cortar a cena.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ajustar = () => {
      const m = 24;
      setEscala(
        Math.max(
          Math.min(
            (el.clientWidth - m * 2) / ASTRO_VIEWBOX.w,
            (el.clientHeight - m * 2) / ASTRO_VIEWBOX.h,
          ),
          0.05,
        ),
      );
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --------------------------------------------------------------- playback
  // `tempo` fica de fora de propósito: entrar na lista reiniciaria o laço a
  // cada quadro. O valor é lido uma vez, quando o play começa.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
  useEffect(() => {
    if (!tocando) return;
    const total = duracaoReal(cena);
    let inicio = 0;
    let id = 0;
    // O relógio corre sem zerar: quem decide o laço é `quadro`, camada a
    // camada. Zerá-lo aqui cortava quem repete para sempre no ponto em que a
    // cena reinicia.
    const passo = (agora: number) => {
      if (!inicio) inicio = agora - tempo * 1000;
      const t = (agora - inicio) / 1000;
      if (!cena.repete && t > total) {
        setTempo(total);
        setTocando(false);
        return;
      }
      setTempo(t);
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [tocando, cena]);

  /** O que desenhar agora: tocando, o quadro do tempo; parado, o estado em edição. */
  const estados = useMemo(() => {
    if (tocando || tempo > 0) return quadro(cena, tempo);
    const saida: Record<string, AstroEstado> = {};
    for (const c of cena.camadas) saida[c.id] = c[modo];
    return saida;
  }, [cena, tempo, tocando, modo]);

  // ----------------------------------------------------------------- edição
  const camadaSel = cena.camadas.find((c) => c.id === sel) ?? null;

  /**
   * Toda escrita numa camada passa por aqui, e toda escrita ressincroniza os
   * vínculos. É uma passada idempotente sobre a cena — mais barato do que
   * descobrir se o que mudou era um líder, e imune a esquecer um caminho.
   */
  const mudarCamada = useCallback((id: string, troca: Partial<AstroCamada>) => {
    setCena((c) => ({
      ...c,
      camadas: sincronizarVinculos(
        c.camadas.map((x) => (x.id === id ? { ...x, ...troca } : x)),
      ),
    }));
  }, []);

  const vincular = useCallback((seguidorId: string, lider: string | null) => {
    setCena((c) => ({
      ...c,
      camadas: sincronizarVinculos(
        c.camadas.map((x) =>
          x.id === seguidorId ? { ...x, vinculo: lider } : x,
        ),
      ),
    }));
  }, []);

  /**
   * Mexer numa camada volta a cena para o instante zero: os campos escrevem no
   * estado de início ou de fim, e continuar tocando mostraria o resultado de
   * uma conta que já não é a que está na tela.
   */
  const mudarEstado = useCallback(
    (id: string, troca: Partial<AstroEstado>) => {
      setCena((c) => ({
        ...c,
        camadas: sincronizarVinculos(
          c.camadas.map((x) =>
            x.id === id ? mexerNaCamada(x, modo, troca) : x,
          ),
        ),
      }));
      setTempo(0);
      setTocando(false);
    },
    [modo],
  );

  /**
   * Acrescenta uma camada garantindo id livre.
   *
   * Duas bocas ou dois globos são cenas legítimas — o que não pode é dois com
   * o MESMO id: a lista, o palco e a linha do tempo procuram a camada por ele,
   * e a segunda roubaria a seleção da primeira.
   */
  const acrescentar = (nova: AstroCamada | null) => {
    if (!nova) return;
    setCena((c) => {
      const usados = new Set(c.camadas.map((x) => x.id));
      const id = usados.has(nova.id)
        ? `${nova.id}-${Date.now().toString(36)}`
        : nova.id;
      return { ...c, camadas: [...c.camadas, { ...nova, id }] };
    });
    setSel(nova.id);
  };

  const adicionarPeca = (peca: PecaNova) => {
    if (!manifesto || !pecas) return;
    if (peca === "globo") return acrescentar(camadaDeGlobo(manifesto));
    if (peca === "boca") return acrescentar(camadaDeBocaNova(pecas));
    if (peca === "olho-esq") return acrescentar(camadaDeOlhoNovo(pecas, "esq"));
    if (peca === "olho-dir") return acrescentar(camadaDeOlhoNovo(pecas, "dir"));
    if (peca === "bola") return acrescentar(camadaDeBolaBranca(manifesto));
    if (peca === "balao") return acrescentar(camadaDeBalao());
    const luva = manifesto.maos[0];
    if (luva) {
      acrescentar(camadaDeMaoNova(luva, cena.camadas.filter(ehLuva).length));
    }
  };

  /**
   * A seleção NÃO pode sobreviver à camada apagada: o painel da direita lê
   * `camadaSel` e o palco procura o nó pelo id — os dois ficariam apontando
   * para o que não existe mais.
   */
  const apagarCamada = (id: string) => {
    setCena((c) => ({
      ...c,
      // A sincronização limpa sozinha os vínculos órfãos: quem seguia a camada
      // apagada volta a ter movimento próprio em vez de um ponteiro solto.
      camadas: sincronizarVinculos(c.camadas.filter((x) => x.id !== id)),
    }));
    if (sel === id) setSel("");
  };

  // ------------------------------------------------------------------ ações
  const trocarLuva = (id: string, luva: LuvaDoCatalogo) => {
    const c = cena.camadas.find((x) => x.id === id);
    if (!c) return;
    // A largura manda e a altura sai da proporção do recorte — senão trocar de
    // luva achata ou estica a mão.
    mudarCamada(id, {
      src: luva.src,
      altura: Math.round(c.largura / luva.prop),
    });
  };

  /**
   * Trocar de modelo traz as MEDIDAS junto.
   *
   * As expressões têm proporções bem diferentes — o olho aberto é alto, o
   * feliz é uma linha larga — e trocar só o arquivo esticaria o desenho na
   * caixa do modelo anterior. Quem troca escolhe uma expressão, não um
   * retângulo.
   */
  const trocarOlho = (camada: AstroCamada, modelo: ModeloDeOlho) => {
    mudarCamada(camada.id, trocaDeOlho(camada, modelo));
  };

  const trocarBoca = (camada: AstroCamada, modelo: ModeloDePeca) => {
    mudarCamada(camada.id, trocaDeBoca(camada, modelo));
  };

  /** O fundo troca de imagem sem mexer no tamanho: ele é a cena inteira. */
  const trocarFundo = (id: string, modelo: ModeloDePeca) => {
    mudarCamada(id, { src: modelo.src });
  };

  async function inserirImagem(file: File) {
    setEnviando(true);
    try {
      const key = await uploadToR2(file, true);
      await registrarMidia.mutateAsync({
        key,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        width: null,
        height: null,
        alt: "",
      });
      const dimensoes = await medir(file);
      const nova = camadaDeImagem(
        file.name.replace(/\.[^.]+$/, ""),
        key,
        dimensoes.largura,
        dimensoes.altura,
        { x: ASTRO_VIEWBOX.w / 2, y: ASTRO_VIEWBOX.h / 2 },
      );
      acrescentar(nova);
    } catch (error) {
      toast.error(
        error instanceof UploadError
          ? error.message
          : "Não foi possível enviar a imagem",
      );
    } finally {
      setEnviando(false);
    }
  }

  const baixar = () => {
    const blob = new Blob([JSON.stringify(cena, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cena.slug || "astro"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const parar = () => {
    setTocando(false);
    setTempo(0);
  };

  const novaCena = () => {
    const c = cenaNova("Sem título");
    setCena(
      manifesto && pecas
        ? { ...c, camadas: [...c.camadas, ...montarAstro(manifesto, pecas)] }
        : c,
    );
    setSel(manifesto ? "mao_esq" : "");
    setSlugSalvo(null);
    parar();
  };

  const abrirSalva = (slug: string) => {
    abrir.mutate(slug, {
      onSuccess: ({ animacao }) => {
        setCena(animacao);
        setSel(animacao.camadas[1]?.id ?? animacao.camadas[0]?.id ?? "");
        setSlugSalvo(animacao.slug);
        parar();
      },
    });
  };

  const excluirSalva = (slug: string) => {
    excluir.mutate(
      { slug },
      {
        onSuccess: () => {
          if (slug === slugSalvo) novaCena();
        },
      },
    );
  };

  return (
    <div className="grid h-[calc(100svh-5rem)] min-h-[34rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Input
          value={cena.nome}
          aria-label="Nome da animação"
          className="h-8 w-52"
          onChange={(e) =>
            setCena((c) => ({
              ...c,
              nome: e.target.value,
              slug: slugificarAnimacao(e.target.value),
            }))
          }
        />

        <Select
          value={cena.momento ?? SEM_MOMENTO}
          onValueChange={(v) =>
            setCena((c) => ({ ...c, momento: v === SEM_MOMENTO ? null : v }))
          }
        >
          <SelectTrigger className="h-8 w-56" aria-label="Momento de uso">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_MOMENTO}>Rascunho (fora do ar)</SelectItem>
            {MOMENTOS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={arquivo}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) inserirImagem(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={novaCena}
          >
            <FilePlus2 className="size-3.5" />
            Nova
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <LayoutGrid className="size-3.5" />
                Poses
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <Poses
                manifesto={manifesto}
                pecas={pecas}
                aoEscolher={(c) => {
                  setCena(c);
                  setSel(c.camadas[1]?.id ?? "");
                  setSlugSalvo(null);
                  parar();
                }}
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-3">
              <Adicionar
                camadas={cena.camadas}
                objetos={pecas?.objetos ?? []}
                enviando={enviando}
                aoAdicionar={adicionarPeca}
                aoAdicionarObjeto={(m) => acrescentar(camadaDeObjeto(m))}
                aoEnviarImagem={() => arquivo.current?.click()}
              />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={baixar}
          >
            <Download className="size-3.5" />
            Baixar .json
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={salvar.isPending}
            onClick={() =>
              salvar.mutate(
                {
                  animacao: cena,
                  momento: cena.momento,
                  slugAtual: slugSalvo ?? undefined,
                },
                {
                  onSuccess: ({ slug }) => {
                    setCena((c) => ({ ...c, slug }));
                    setSlugSalvo(slug);
                  },
                },
              )
            }
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[13rem_minmax(0,1fr)_17rem]">
        <Camadas
          cena={cena}
          sel={sel}
          salvas={animacoes}
          slugAberto={slugSalvo ?? ""}
          aoSelecionar={setSel}
          aoMudarCamada={mudarCamada}
          aoApagarCamada={apagarCamada}
          aoMudarCena={(t) => setCena((c) => ({ ...c, ...t }))}
          aoAbrir={abrirSalva}
          aoExcluir={excluirSalva}
        />

        <main
          ref={area}
          className="relative flex min-h-[20rem] items-center justify-center overflow-hidden bg-[#04101f]"
        >
          {/*
            A dica muda com o modo porque o arrasto faz coisas DIFERENTES nos
            dois: no início ele muda a peça de lugar levando o movimento junto;
            no fim ele desenha o movimento. Dizer só "posição de início"
            escondia justamente isso.
          */}
          <p className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] text-white/45">
            {modo === "ini" ? (
              <>
                arraste para <b className="text-[#2fc0fe]">mover a peça</b> — o
                movimento vai junto
              </>
            ) : (
              <>
                arraste para definir{" "}
                <b className="text-[#2fc0fe]">onde o movimento termina</b>
              </>
            )}
          </p>
          <Palco
            camadas={cena.camadas}
            estados={estados}
            sel={sel}
            tocando={tocando}
            escala={escala}
            aoSelecionar={setSel}
            aoMover={mudarEstado}
          />
        </main>

        <Propriedades
          camada={camadaSel}
          modo={modo}
          luvas={manifesto?.maos ?? []}
          pecas={pecas}
          aoTrocarModo={setModo}
          aoMudarEstado={(t) => camadaSel && mudarEstado(camadaSel.id, t)}
          aoMudarCamada={(t) => camadaSel && mudarCamada(camadaSel.id, t)}
          aoTrocarLuva={(l) => camadaSel && trocarLuva(camadaSel.id, l)}
          aoTrocarOlho={(m) => camadaSel && trocarOlho(camadaSel, m)}
          aoTrocarBoca={(m) => camadaSel && trocarBoca(camadaSel, m)}
          aoTrocarFundo={(m) => camadaSel && trocarFundo(camadaSel.id, m)}
          camadas={cena.camadas}
          aoVincular={vincular}
          aoAplicarMovimento={(m) =>
            camadaSel && mudarCamada(camadaSel.id, m.aplicar(camadaSel))
          }
        />
      </div>

      <LinhaDoTempo
        cena={cena}
        // O relógio corre sem fim; a régua mostra onde a cena está NA VOLTA
        // dela, senão o mostrador passaria de "2.40 / 2.40s" e seguiria subindo.
        tempo={
          cena.repete
            ? tempo % duracaoReal(cena)
            : Math.min(tempo, duracaoReal(cena))
        }
        tocando={tocando}
        sel={sel}
        aoSelecionar={setSel}
        aoMudarCamada={mudarCamada}
        aoTocar={() => setTocando((v) => !v)}
        aoParar={parar}
        aoBuscar={(t) => {
          setTocando(false);
          setTempo(t);
        }}
      />
    </div>
  );
}

const CANAIS = ["x", "y", "rot", "esc", "op"] as const;

/**
 * Escreve no estado que está sendo editado — e, no INÍCIO, leva o fim junto.
 *
 * Mover uma peça é reposicioná-la, não reanimá-la. Escrevendo só no início, o
 * fim ficava para trás: arrastar um olho dez pixels transformava um flutuar de
 * 10px numa queda de 84px, porque o destino continuava onde a peça estava
 * antes. Levando o fim pelo mesmo deslocamento, o gesto sobrevive à mudança de
 * lugar — que é o que se espera de arrastar.
 *
 * Editar o FIM continua mexendo só nele: é ali que se dá forma ao movimento.
 */
function mexerNaCamada(
  camada: AstroCamada,
  modo: Modo,
  troca: Partial<AstroEstado>,
): AstroCamada {
  if (modo === "fim") return { ...camada, fim: { ...camada.fim, ...troca } };

  const ini = { ...camada.ini, ...troca };
  const fim = { ...camada.fim };
  for (const canal of CANAIS) {
    const novo = troca[canal];
    if (novo === undefined) continue;
    fim[canal] = camada.fim[canal] + (novo - camada.ini[canal]);
  }
  // A opacidade é o único canal com teto; o resto o formato aceita livre.
  fim.op = Math.min(Math.max(fim.op, 0), 1);
  return { ...camada, ini, fim };
}

/** O tamanho real do arquivo, para a camada nascer na proporção certa. */
function medir(file: File): Promise<{ largura: number; altura: number }> {
  return new Promise((resolve) => {
    const uri = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(uri);
      resolve({ largura: img.width, altura: img.height });
    };
    // Arquivo que o navegador não decodifica ainda vira camada: um quadrado é
    // melhor do que um upload perdido.
    img.onerror = () => {
      URL.revokeObjectURL(uri);
      resolve({ largura: 300, altura: 300 });
    };
    img.src = uri;
  });
}
