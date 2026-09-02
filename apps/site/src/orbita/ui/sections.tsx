"use client";

import { BRAND } from "../data/site";
import { useSiteContent } from "../lib/content-context";
import { ORBIT_BY_CATEGORY, ORBIT_TOOLS } from "../data/catalog";
import { progressForAngle, toolAngles } from "../lib/orbit";
import { openProduct } from "../lib/product-store";
import { useReveal } from "../hooks/use-reveal";
import { useAnchor } from "../hooks/use-anchor";
import { scrollToProgress } from "../hooks/use-scroll-timeline";
import { legacy } from "../lib/timeline";

/**
 * As seções não são blocos empilhados: são janelas de progresso da órbita.
 *
 * Cada bloco declara em que trecho da viagem ele existe. Fora dessa janela
 * ele não está "abaixo da dobra" — ele simplesmente ainda não chegou, ou já
 * ficou para trás.
 */

/* --- 05. Hero ----------------------------------------------------------- */

export function Hero({
  secondaryHref = "#contato",
}: {
  secondaryHref?: string;
}) {
  const ref = useReveal({
    inStart: legacy(-0.04),
    inEnd: legacy(-0.01),
    outStart: legacy(0.05),
    outEnd: legacy(0.115),
    y: 18,
    blur: 8,
  });

  return (
    <div className="o-block o-block--hero" id="inicio">
      <div className="o-stack o-plate" ref={ref}>
        <span className="o-eyebrow">
          {BRAND.name} {BRAND.suffix}
        </span>
        <h1 className="o-display o-glow-text">
          Tecnologia que orbita possibilidades.
        </h1>
        <p className="o-lead">
          Conectamos tecnologia, gestão, dados e inovação para transformar
          negócios.
        </p>
        <div className="o-actions">
          <button
            type="button"
            className="o-btn o-btn--primary"
            onClick={() => scrollToProgress(legacy(0.3))}
          >
            Conheça nossas soluções
            <Arrow />
          </button>
          <a className="o-btn o-btn--ghost" href={secondaryHref}>
            Fale conosco
          </a>
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
      <path
        d="M0 5h12M8.5 1L12.5 5L8.5 9"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
    </svg>
  );
}

/* --- A suíte: categorias e ferramentas ---------------------------------- */

/**
 * Cada categoria manda enquanto o seu arco da órbita passa.
 *
 * As janelas não são escritas à mão: saem dos próprios ângulos das ferramentas.
 * Mover uma ferramenta de categoria reposiciona o título sozinho, e o texto
 * nunca descola dos pontos que ele apresenta.
 */
const ANGLES = toolAngles(ORBIT_TOOLS.length);

const CATEGORY_WINDOWS = ORBIT_BY_CATEGORY.map((category) => {
  const indexes = category.tools.map((tool) => ORBIT_TOOLS.indexOf(tool));
  const first = progressForAngle(ANGLES[Math.min(...indexes)]);
  const last = progressForAngle(ANGLES[Math.max(...indexes)]);
  return { ...category, first, last };
});

export function SuiteSections() {
  return (
    <>
      {CATEGORY_WINDOWS.map((category, index) => (
        <CategoryTitle key={category.id} category={category} index={index} />
      ))}
    </>
  );
}

function CategoryTitle({
  category,
  index,
}: {
  category: (typeof CATEGORY_WINDOWS)[number];
  index: number;
}) {
  const ref = useReveal({
    inStart: category.first - legacy(0.055),
    inEnd: category.first - legacy(0.012),
    outStart: category.last + legacy(0.012),
    outEnd: category.last + legacy(0.05),
    y: 24,
    blur: 7,
  });

  return (
    <div
      className="o-block o-block--section"
      id={index === 0 ? "solucoes" : index === 3 ? "produtos" : undefined}
    >
      <div className="o-stack o-plate" ref={ref}>
        <span className="o-eyebrow">
          A suíte · {String(index + 1).padStart(2, "0")} de{" "}
          {String(CATEGORY_WINDOWS.length).padStart(2, "0")}
        </span>
        <h2 className="o-title">{category.title}</h2>
        <p className="o-lead">{category.lead}</p>
      </div>
    </div>
  );
}

/**
 * Os rótulos das ferramentas.
 *
 * Não são cards: são etiquetas presas a nós reais da órbita. Posição, escala,
 * brilho e oclusão vêm da cena — aqui mora só o texto e o clique, que abre o
 * produto pelo mesmo caminho de quem clica na esfera.
 */
export function ToolLabels() {
  return (
    <>
      {ORBIT_TOOLS.map((tool, index) => (
        <ToolLabel key={tool.id} tool={tool} angle={ANGLES[index]} />
      ))}
    </>
  );
}

function ToolLabel({
  tool,
  angle,
}: {
  tool: (typeof ORBIT_TOOLS)[number];
  angle: number;
}) {
  const ref = useAnchor<HTMLDivElement>(`tool-${tool.id}`);

  return (
    <div className="o-station" ref={ref} data-hidden="true">
      <button
        type="button"
        className="o-station__inner"
        onClick={() => openProduct(tool.id, angle)}
      >
        <span className="o-eyebrow">{tool.tagline}</span>
        <span className="o-station__title">{tool.name}</span>
        <span className="o-station__detail">
          Ver as {tool.features.length} funcionalidades
        </span>
      </button>
    </div>
  );
}

/* --- 11. Momento de impacto -------------------------------------------- */

export function Impact() {
  const ref = useReveal({
    inStart: legacy(0.775),
    inEnd: legacy(0.815),
    outStart: legacy(0.845),
    outEnd: legacy(0.878),
    y: 30,
    blur: 12,
    scale: 0.94,
  });

  return (
    <div className="o-block o-block--impact">
      <div className="o-stack o-plate" ref={ref}>
        <p className="o-impact__line">
          <span>Tudo conectado.</span>
          <em>Tudo em movimento.</em>
        </p>
      </div>
    </div>
  );
}

/* --- 12. Sobre ---------------------------------------------------------- */

export function About() {
  const { stats } = useSiteContent();
  /*
    O "Sobre" tem a mesma duração dos títulos da suíte.

    Ele ficava nítido por 0.020 de progresso, contra 0.115 a 0.182 de cada
    categoria — sumia antes de ser lido. A janela não podia crescer para trás,
    onde está o impacto, então cresceu para a frente: a saída agora cai no
    começo da descida, que é um trecho em que a câmera ainda não se move e não
    há nada mais na tela. O texto acompanha o planeta começando a crescer, e
    sai quando a descida de fato começa.
  */
  const ref = useReveal({
    inStart: legacy(0.845),
    inEnd: legacy(0.88),
    outStart: legacy(0.995),
    outEnd: legacy(1.03),
    y: 22,
    blur: 6,
  });

  return (
    <>
      <div className="o-block o-block--section" id="sobre">
        <div className="o-stack o-plate" ref={ref}>
          <span className="o-eyebrow">Sobre nós</span>
          <h2 className="o-title">Orbitamos com você em cada desafio.</h2>
        </div>
      </div>
      <div className="o-block o-block--about">
        <div className="o-stack">
          <div className="o-stats">
            {stats.map((stat, i) => (
              <Stat key={stat.label} stat={stat} index={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({
  stat,
  index,
}: {
  stat: { value: string; label: string };
  index: number;
}) {
  /*
    Os números entram um a um, e todos ficam nítidos antes de sair.

    A janela original tinha um defeito de sobreposição: com o stagger cheio, o
    quarto indicador começava a entrar depois de a saída já ter começado, e
    passava a seção inteira borrado, sem nunca ter sido legível.

    Hoje eles acompanham o título — mesma janela larga, poucos milésimos antes
    dele, para o bloco todo entrar e sair junto.
  */
  const ref = useReveal({
    inStart: legacy(0.85),
    inEnd: legacy(0.885),
    outStart: legacy(0.99),
    outEnd: legacy(1.025),
    y: 18,
    blur: 5,
    stagger: index * 0.3,
  });

  return (
    <div className="o-stat" ref={ref}>
      <p className="o-stat__value">{stat.value}</p>
      <p className="o-stat__label">{stat.label}</p>
    </div>
  );
}

/* --- 13. CTA final ------------------------------------------------------ */

export function FinalCTA({ href = "#contato" }: { href?: string }) {
  const ref = useReveal({
    inStart: 0.928,
    inEnd: 0.95,
    outStart: 0.978,
    outEnd: 0.995,
    y: 24,
    blur: 8,
  });

  return (
    <div className="o-block o-block--cta" id="contato">
      <div className="o-stack o-plate" ref={ref}>
        <span className="o-eyebrow">Vamos conversar</span>
        <h2 className="o-title">Pronto para orbitar o futuro?</h2>
        <p className="o-lead">
          Fale com nossos especialistas e descubra como podemos impulsionar o
          seu negócio.
        </p>
        <div className="o-actions" style={{ justifyContent: "center" }}>
          <a className="o-btn o-btn--primary" href={href}>
            Fale com um especialista
            <Arrow />
          </a>
        </div>
      </div>
    </div>
  );
}
