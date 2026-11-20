"use client";

import {
  Fragment,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  METODO_ETAPAS,
  ferramentasForaDaJornada,
  ORBITAS,
  orbitaDeFerramenta,
  SEQUENCIA,
  type Orbita,
  type PassoId,
} from "@nerp/site-content";
import { findTool, TOOLS } from "@/orbita/data/catalog";
import { asset } from "@/orbita/lib/assets";
import { useEnvironment } from "@/orbita/hooks/use-environment";
import { CENA_PRONTA } from "@/orbita/lib/cortina";
import type { Projecao } from "./cena";
import "./jornada.css";

const CanvasJornada = lazy(() =>
  import("./cena").then((m) => ({ default: m.CanvasJornada })),
);

/** Quanto tempo a cena fica parada depois do último movimento do cursor. */
const PAUSA_MS = 1800;

/**
 * A jornada do ecossistema.
 *
 * Dois caminhos, e os dois entregam a mesma informação:
 *
 * - **HTML**, sempre renderizado: as cinco órbitas em lista, com as soluções
 *   de cada uma como link. É o que o buscador indexa, o que funciona sem
 *   JavaScript e o que vale para quem pediu movimento reduzido.
 * - **Cena 3D**, só no cliente com WebGL: a mesma lista, em órbita.
 *
 * Nunca é "3D ou nada". Quem cai no HTML não perde conteúdo — perde a cena.
 */
export function Jornada() {
  const env = useEnvironment();
  const router = useRouter();
  const imersivo = env.ready && env.webgl && !env.reducedMotion && !env.compact;

  // Sem cena não há quadro que avise: quem está cobrindo a tela à espera dela
  // (o painel de soluções, em cortina) é liberado aqui mesmo.
  useEffect(() => {
    if (env.ready && !imersivo) window.dispatchEvent(new Event(CENA_PRONTA));
  }, [env.ready, imersivo]);

  /*
    O passo da jornada guiada.

    Começa no hero: quem chega vê uma coisa de cada vez. "Ver o mapa completo"
    salta para o fim — é o atalho de quem já conhece e só quer o panorama.
  */
  const [passo, setPasso] = useState<PassoId>("hero");
  /*
    Até onde o visitante já chegou.

    A jornada é sequencial de propósito: cada etapa só faz sentido depois da
    anterior, e abrir tudo de uma vez devolveria o infográfico que a jornada
    veio substituir. Voltar é livre; pular à frente, não.
  */
  const [alcancado, setAlcancado] = useState(0);
  /*
    O bloco do método só existe depois que o visitante clica em "Iniciar".

    Ele explica COMO a jornada funciona, e isso só interessa a quem decidiu
    começar: quem acabou de chegar vê a cena limpa. Qualquer outro destino o
    fecha de novo — é por isso que `irPara` o desliga e só o clique em
    "Iniciar" o religa.
  */
  const [metodoAberto, setMetodoAberto] = useState(false);
  const orbitaDoPasso = passo.startsWith("orbita-")
    ? Number(passo.slice(-1))
    : null;

  const [parado, setParado] = useState(false);
  const [focado, setFocado] = useState<string | null>(null);
  const [projecoes, setProjecoes] = useState<Projecao[]>([]);
  /*
    A órbita sob o cursor. Mostrar o nome no canto resolve o que nenhuma
    colocação na cena resolveu: cinco elipses concêntricas não têm onde caber
    cinco nomes sem um cruzar o outro ou o destino.
  */
  const [orbitaApontada, setOrbitaApontada] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
    Quanto de página existe acima da jornada.

    Com a cena no ar, a seção ocupa exatamente o resto da janela, e o palco o
    que sobra abaixo dos cartões. É isso que deixa a órbita centrada no espaço
    livre: o canvas É o espaço livre. A altura do cabeçalho do site não é
    conhecida daqui, então medimos onde a seção começa.
  */
  const secao = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = secao.current;
    if (!el) return;
    const medir = () =>
      el.style.setProperty(
        "--jor-acima",
        `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`,
      );
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  /*
    "Mexeu o cursor, os eixos param."

    Sem isto, mirar num planeta é perseguir alvo móvel. A pausa dura um tempo
    curto depois do último movimento: quem está lendo vê a cena viva de novo,
    quem está escolhendo tem o tempo que precisar.
  */
  const aoMover = useCallback(() => {
    setParado(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParado(false), PAUSA_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const abrir = useCallback((href: string) => router.push(href), [router]);

  const irPara = useCallback((destino: PassoId) => {
    setPasso(destino);
    setMetodoAberto(false);
    /*
      O cursor continua em cima do cartão que foi clicado, e o hover dele
      segurava o foco na etapa ANTERIOR: a nova abria apagada, e só acendia
      quando o visitante levava o mouse até o botão dela. O clique é uma
      escolha mais forte que o hover que o precedeu — ele limpa o apontado, e
      o foco passa a ser o do passo até o cursor entrar em outro cartão.
    */
    setOrbitaApontada(null);
    setAlcancado((antes) => Math.max(antes, SEQUENCIA.indexOf(destino)));
  }, []);

  /** "Iniciar": mostra o método e destrava a primeira etapa. */
  const iniciar = useCallback(() => {
    setPasso("hero");
    setMetodoAberto(true);
    setAlcancado((antes) => Math.max(antes, SEQUENCIA.indexOf("orbita-1")));
  }, []);

  /** Volta ao começo de verdade: etapas travadas e traços recolhidos. */
  const reiniciar = useCallback(() => {
    setPasso("hero");
    setMetodoAberto(false);
    setAlcancado(0);
    setOrbitaApontada(null);
    setFocado(null);
  }, []);

  /*
    A etapa que acabou de abrir — a que tem os planetas crescidos.

    Normalmente é a do passo. A exceção é a partida com o método à vista: o
    clique em "Iniciar" destrava "Atração", e o botão que acende sem a órbita
    dele aparecer parecia defeito. Então a primeira órbita já se anuncia ali,
    com o traço e os planetas, antes mesmo de virar o passo.
  */
  const orbitaEmDestaque =
    orbitaDoPasso ?? (passo === "hero" && metodoAberto ? 1 : null);

  /*
    Quantas órbitas mostram o traço.

    Segue o passo ATUAL, não o mais longe que o visitante chegou: na chegada
    a cena é só os planetas, e cada etapa acrescenta a sua linha às anteriores.
    Voltar um passo recolhe a última — a tela sempre conta em que ponto da
    jornada se está.
  */
  const orbitasReveladas =
    passo === "mapa" ? ORBITAS.length : (orbitaEmDestaque ?? 0);

  /** A órbita em foco: o cursor manda; sem cursor, vale a do passo. */
  const orbitaFoco = orbitaApontada ?? orbitaDoPasso;

  const focadoTool = focado ? findTool(focado) : null;
  const orbitaFocada = focado
    ? ORBITAS.find((o) => o.tools.includes(focado))
    : null;

  return (
    <section
      ref={secao}
      className={`jor${imersivo ? " jor--imersivo" : ""}`}
      aria-labelledby="jor-titulo"
    >
      <header className="jor__topo">
        {/*
          O título fica só para a acessibilidade e para o documento.

          Na tela ele saiu: a cena já diz o que é, e o texto ocupava o espaço
          que a cadeia de etapas usa melhor. A `section` continua precisando de
          um nome — sem ele, o leitor de tela anuncia "região" e nada mais.
        */}
        <h2 id="jor-titulo" className="sr">
          O ecossistema Órbita em movimento
        </h2>

        {/*
          A cadeia é a navegação inteira da jornada.

          O primeiro cartão é o começo; os seguintes nascem bloqueados e abrem
          um a um. É o que transforma a cena de mapa em percurso: o visitante
          não vê trinta e uma soluções de uma vez, vê a etapa em que está.
        */}
        <nav className="jor__etapas" aria-label="Etapas da jornada">
          <Cartao
            cor="#4aa8f0"
            icone={<IconePlay />}
            titulo="Iniciar"
            indice={0}
            ativo={passo === "hero"}
            bloqueado={false}
            aoEntrar={() => setOrbitaApontada(null)}
            aoSair={() => setOrbitaApontada(null)}
            aoAbrir={iniciar}
            // O primeiro clique abre o método; com ele à vista, o mesmo botão
            // segue para a primeira etapa.
            aoAvancar={() =>
              passo === "hero" && metodoAberto ? irPara("orbita-1") : iniciar()
            }
          />
          <span className="jor__etapa-seta" aria-hidden>
            »
          </span>
          {ORBITAS.map((orbita, i) => {
            const idPasso = `orbita-${orbita.n}` as PassoId;
            const posicao = SEQUENCIA.indexOf(idPasso);
            const bloqueado = posicao > alcancado;
            const ultima = i === ORBITAS.length - 1;
            // No fim do percurso, o botão que levou ao mapa passa a ser a
            // saída dele: sem isso a jornada terminava num beco.
            const noFim = ultima && passo === "mapa";
            return (
              <Fragment key={orbita.id}>
                <Cartao
                  cor={orbita.color}
                  icone={ICONES[orbita.id] ?? <IconePlay />}
                  titulo={orbita.title}
                  sub={orbita.subtitle}
                  indice={i + 1}
                  ativo={passo === idPasso}
                  bloqueado={bloqueado}
                  rotuloAvancar={
                    noFim ? "Reiniciar" : ultima ? "Ver tudo" : "Próximo"
                  }
                  seta={noFim ? "↺" : "→"}
                  aoEntrar={() => !bloqueado && setOrbitaApontada(orbita.n)}
                  aoSair={() => setOrbitaApontada(null)}
                  aoAbrir={() => !bloqueado && irPara(idPasso)}
                  aoAvancar={() => {
                    if (noFim) reiniciar();
                    else
                      irPara(
                        ultima ? "mapa" : (`orbita-${orbita.n + 1}` as PassoId),
                      );
                  }}
                />
                {!ultima && (
                  <span className="jor__etapa-seta" aria-hidden>
                    »
                  </span>
                )}
              </Fragment>
            );
          })}
        </nav>

        {/* O método: só depois de "Iniciar", só enquanto se está na partida. */}
        {passo === "hero" && metodoAberto && (
          <div className="jor__metodo">
            <div className="jor__metodo-tit">
              {/* A marca no lugar do título: é logotipo, não texto. */}
              {/* biome-ignore lint/performance/noImgElement: asset fixo do site, passa por `asset()` — mesma regra do resto da cena. */}
              <img
                className="jor__metodo-logo"
                src={asset("/orbita/nasa-logo.webp")}
                alt="Método N.A.S.A"
                width={747}
                height={182}
              />
              <span className="jor__metodo-sub">
                Do desafio ao resultado, com um método claro.
              </span>
            </div>
            <ol>
              {METODO_ETAPAS.map((etapa, i) => (
                <li key={`${etapa.mark}-${etapa.title}`}>
                  <span>
                    <b>{etapa.title}</b>
                    <i>{etapa.question}</i>
                  </span>
                  {i < METODO_ETAPAS.length - 1 && (
                    <em className="jor__metodo-seta" aria-hidden>
                      ›
                    </em>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </header>

      {imersivo ? (
        <div
          className="jor__palco"
          onPointerMove={aoMover}
          onPointerLeave={() => setFocado(null)}
        >
          {/*
            O nome do centro vem ANTES do canvas, e a ordem é a razão de ser
            desta camada: o canvas é transparente e pinta por cima, então todo
            planeta que cruza a frente do centro cobre o nome. Na camada dos
            outros rótulos ele ficava por cima das esferas da órbita 5, que
            passam exatamente ali.

            O centro é a ETAPA, não o produto. Star Friends é um dos planetas
            da órbita 5 — nomear o centro com ele faria o visitante ler o
            destino como "um produto", e não como o que a jornada persegue.
          */}
          <div className="jor__rotulos" aria-hidden>
            {(() => {
              const p = projecoes.find((x) => x.id === "destino");
              const retencao = ORBITAS[ORBITAS.length - 1];
              if (!p?.visivel || !retencao) return null;
              return (
                <span
                  className="jor__destino"
                  style={{
                    left: p.x,
                    top: p.y,
                    opacity:
                      orbitaFoco !== null && orbitaFoco !== retencao.n
                        ? 0.12
                        : 1,
                  }}
                >
                  <b>{retencao.title}</b>
                  <i>{retencao.subtitle}</i>
                </span>
              );
            })()}
          </div>

          <Suspense fallback={<div className="jor__carregando" />}>
            <CanvasJornada
              dpr={env.quality.dpr}
              estrelas={env.quality.stars}
              parado={parado}
              focado={focado}
              aoFocar={setFocado}
              aoAbrir={abrir}
              aoProjetar={setProjecoes}
              orbitaAtiva={orbitaFoco}
              orbitasReveladas={orbitasReveladas}
              orbitaEmDestaque={orbitaEmDestaque}
              aoApontarOrbita={setOrbitaApontada}
              aoEscolherOrbita={(n) => setPasso(`orbita-${n}` as PassoId)}
            />
          </Suspense>

          {/*
            A frase da chegada.

            Ela descreve o que está na tela: planetas soltos, sem órbita, sem
            ordem. E some no clique que prometeu — "Próximo" abre o método e a
            primeira órbita, e a cena passa a provar o que a frase dizia.
            Fica sobre o palco, e não no fluxo do cabeçalho: no fluxo ela
            encolheria o canvas e a cena pularia de lugar quando sumisse.
          */}
          {passo === "hero" && !metodoAberto && (
            <p className="jor__chamada">
              Sem método tudo parece desalinhado, até você clicar em próximo
            </p>
          )}

          {(() => {
            const o = orbitaFoco
              ? ORBITAS.find((x) => x.n === orbitaFoco)
              : null;
            return o ? (
              <output className="jor__orbita-canto" style={{ color: o.color }}>
                <b>{o.title}</b>
                <i>{o.subtitle}</i>
                <ul>
                  {o.tools.map((id) => {
                    const t = findTool(id);
                    return t ? <li key={id}>{t.name}</li> : null;
                  })}
                </ul>
              </output>
            ) : null;
          })()}

          <div className="jor__rotulos" aria-hidden>
            {projecoes.map((p) => {
              if (!p.visivel) return null;
              // O nome do centro mora na camada de trás, antes do canvas.
              if (p.id === "destino") return null;
              const tool = findTool(p.id);
              if (!tool) return null;
              /*
                O nome acompanha o corpo, sempre: aparece quando a órbita dele
                está em foco (pelo cursor, pelo passo ou no mapa final) e apaga
                junto com o planeta. A conta do "apagado" é a mesma da cena de
                propósito — quando eram duas regras, no mapa final o planeta
                sumia ao apontar outra órbita e o nome dele ficava aceso,
                boiando sobre o nada.
              */
              const orbitaDele = orbitaDeFerramenta(p.id);
              const naEtapa =
                orbitaFoco !== null && orbitaDele?.n === orbitaFoco;
              const apagado =
                (focado !== null && focado !== p.id) ||
                (orbitaFoco !== null && !naEtapa);
              const foraDoFoco = !(
                focado === p.id ||
                (!apagado && (naEtapa || passo === "mapa"))
              );
              return (
                <span
                  key={p.id}
                  // Planeta crescido pede o nome mais alto: no lugar de
                  // sempre, a esfera maior encostaria na etiqueta.
                  className={`jor__rotulo${
                    orbitaDele?.n === orbitaEmDestaque
                      ? " jor__rotulo--alto"
                      : ""
                  }`}
                  style={{
                    left: p.x,
                    top: p.y,
                    opacity: foraDoFoco ? 0 : 1,
                  }}
                >
                  {tool.name}
                </span>
              );
            })}
          </div>

          {focadoTool && orbitaFocada && (
            <aside
              className="jor__ficha"
              style={{ borderColor: orbitaFocada.color }}
            >
              <p
                className="jor__ficha-orbita"
                style={{ color: orbitaFocada.color }}
              >
                {orbitaFocada.n}. {orbitaFocada.title}
              </p>
              <h3>{focadoTool.name}</h3>
              <p>{focadoTool.summary}</p>
              <span className="jor__ficha-link">Ver a página →</span>
            </aside>
          )}

          <p className="jor__dica">
            Mexa o cursor e os eixos param. Clique num planeta para abrir a
            solução.
          </p>
        </div>
      ) : null}

      {/*
        A lista das órbitas. Sempre no HTML: é a versão indexável e a que vale
        sem WebGL. Na cena, ela vira a legenda abaixo do palco.
      */}
      {/*
        Com a cena no ar, a lista sai da VISTA mas não do documento: é ela que
        o buscador indexa e o teclado percorre. Esconder com `display: none`
        tiraria as duas coisas.
      */}
      <ol className={`jor__orbitas${imersivo ? " jor__orbitas--oculta" : ""}`}>
        {ORBITAS.map((orbita) => (
          <ItemOrbita key={orbita.id} orbita={orbita} resumida={imersivo} />
        ))}
      </ol>

      {/*
        As soluções que a narrativa não conta.

        A jornada usa 19 das 31; as outras são de operação de loja e de trade,
        com história própria. Antes elas chegavam aqui pela grade de cards —
        que saiu da página. Sem esta lista, doze páginas de produto perderiam
        o link interno que vinha do índice da seção. Ela não aparece: existe
        para o buscador e para o teclado.
      */}
      <section className="jor__orbitas--oculta">
        <h3>Outras soluções da suíte</h3>
        <ul>
          {ferramentasForaDaJornada(TOOLS).map((tool) => (
            <li key={tool.id}>
              <Link href={tool.href ?? `/solucoes/${tool.id}`}>
                {tool.name} — {tool.tagline}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function ItemOrbita({
  orbita,
  resumida,
}: {
  orbita: Orbita;
  resumida: boolean;
}) {
  return (
    <li className="jor__orbita" style={{ ["--cor" as string]: orbita.color }}>
      <p className="jor__orbita-cab">
        <b>
          {orbita.n}. {orbita.title}
        </b>
        <i>{orbita.subtitle}</i>
      </p>
      {!resumida && (
        <>
          <p className="jor__orbita-lead">{orbita.lead}</p>
          <p className="jor__orbita-dor">{orbita.pain}</p>
        </>
      )}
      <ul>
        {orbita.tools.map((id) => {
          const tool = findTool(id);
          if (!tool) return null;
          return (
            <li key={id}>
              <Link
                className="jor__orbita-link"
                href={tool.href ?? `/solucoes/${id}`}
              >
                <b>{tool.name}</b>
                <span>{tool.tagline}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/* ------------------------------------------------------------- os cartões */

/** Ícones das etapas. Traço fino, 24px, herdando a cor do cartão. */
const Svg = ({ children }: { children: React.ReactNode }) => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: ícone decorativo — quem nomeia é o `aria-label` do botão que o contém.
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

const IconePlay = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
  </Svg>
);

const ICONES: Record<string, React.ReactNode> = {
  // Ímã: a etapa que atrai o que ainda está fora.
  atracao: (
    <Svg>
      <path d="M6 4v8a6 6 0 0012 0V4" />
      <path d="M3 4h6M15 4h6M3 12h6M15 12h6" />
    </Svg>
  ),
  atendimento: (
    <Svg>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0111 0" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M14.5 19a4.4 4.4 0 016.5-3.8" />
    </Svg>
  ),
  operacao: (
    <Svg>
      <path d="M5 19V11M12 19V5M19 19v-6" />
    </Svg>
  ),
  entrega: (
    <Svg>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </Svg>
  ),
  retencao: (
    <Svg>
      <path d="M20 12a8 8 0 01-13.7 5.6M4 12a8 8 0 0113.7-5.6" />
      <path d="M4 7v5h5M20 17v-5h-5" />
    </Svg>
  ),
};

/**
 * O cartão de uma etapa.
 *
 * O desenho é o do painel de bordo: cantos chanfrados, borda que acende na cor
 * da etapa e o botão de avançar por dentro. Bloqueado, ele continua visível —
 * o visitante precisa ver que existe mais caminho pela frente; só não pode
 * pular para lá.
 */
function Cartao({
  cor,
  icone,
  titulo,
  sub,
  indice,
  ativo,
  bloqueado,
  rotuloAvancar = "Próximo",
  seta = "→",
  aoEntrar,
  aoSair,
  aoAbrir,
  aoAvancar,
}: {
  cor: string;
  icone: React.ReactNode;
  titulo: string;
  sub?: string;
  /** A posição na cadeia: defasa a flutuação, para os cartões não subirem juntos. */
  indice: number;
  ativo: boolean;
  bloqueado: boolean;
  rotuloAvancar?: string;
  seta?: string;
  aoEntrar: () => void;
  aoSair: () => void;
  aoAbrir: () => void;
  aoAvancar: () => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: o `div` só agrupa o hover do conjunto; foco, clique e nome acessível ficam nos dois botões internos.
    <div
      className={`jor__cartao${ativo ? " jor__cartao--ativo" : ""}${
        bloqueado ? " jor__cartao--travado" : ""
      }`}
      style={{ ["--cor" as string]: cor, ["--i" as string]: indice }}
      onMouseEnter={aoEntrar}
      onMouseLeave={aoSair}
    >
      {/* O recorte dos cantos mora aqui dentro: `clip-path` no mesmo elemento
          do brilho cortaria o brilho junto. */}
      <div className="jor__cartao-corpo">
        <button
          type="button"
          className="jor__cartao-alvo"
          disabled={bloqueado}
          aria-label={sub ? `${titulo} — ${sub}` : titulo}
          aria-current={ativo ? "step" : undefined}
          onClick={aoAbrir}
          onFocus={aoEntrar}
          onBlur={aoSair}
        >
          <span className="jor__cartao-icone">{icone}</span>
          <span className="jor__cartao-txt">
            <b>{titulo}</b>
            {sub && <i>{sub}</i>}
          </span>
        </button>
        <button
          type="button"
          className="jor__cartao-prox"
          disabled={bloqueado}
          onClick={aoAvancar}
        >
          {rotuloAvancar} <span aria-hidden>{seta}</span>
        </button>
      </div>
    </div>
  );
}
