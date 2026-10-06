"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  Line,
  LineBasicMaterial,
  type Mesh,
  type PerspectiveCamera,
  Vector3,
} from "three";
import { ORBITAS } from "@nerp/site-content";
import { findTool } from "@/orbita/data/catalog";
import { CENA_PRONTA } from "@/orbita/lib/cortina";
import {
  ACHATAMENTO,
  corposDaJornada,
  DIRECAO_DA_CAMERA,
  LARGURA_CADEIA,
  PADDING_LATERAL,
  posicao,
  RAIOS,
} from "./geometria";
import { AstroCentro } from "./astro-centro";
import {
  estiloDaFerramenta,
  texturaEstrela,
  texturaNebulosa,
  texturaPlaneta,
} from "./texturas";

/*
  A cena da jornada.

  Ela não reaproveita a cena da home de propósito: lá a câmera é conduzida pelo
  scroll e a geometria sai da contagem de estações; aqui o eixo é a distância
  até o centro, e o visitante manda no tempo — mexeu o cursor, tudo para.
*/

/** Posição projetada de cada corpo, para os rótulos em HTML acompanharem. */
export type Projecao = { id: string; x: number; y: number; visivel: boolean };

/** A força do relevo. Acima disto a luz rasante vira serrilhado. */
const RELEVO = 2.2;

function Estrelas({ quantidade }: { quantidade: number }) {
  const textura = useMemo(() => texturaEstrela(), []);
  const geometria = useMemo(() => {
    const pontos: number[] = [];
    const cores: number[] = [];
    const tamanhos: number[] = [];
    /*
      Estrela real não é branca: a maioria puxa para o azul-branco, uma parte
      para o âmbar, e poucas são muito brilhantes. Pontos todos iguais é o que
      faz um céu parecer papel de parede.
    */
    for (let i = 0; i < quantidade; i++) {
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      const r = 60 + Math.random() * 90;
      pontos.push(
        r * Math.sin(p) * Math.cos(t),
        r * Math.cos(p) * 0.7,
        r * Math.sin(p) * Math.sin(t),
      );
      const tipo = Math.random();
      if (tipo > 0.88) cores.push(1, 0.82, 0.62);
      else if (tipo > 0.6) cores.push(0.76, 0.86, 1);
      else cores.push(1, 1, 1);
      tamanhos.push(Math.random() > 0.94 ? 1.9 : 0.5 + Math.random() * 0.7);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pontos, 3));
    g.setAttribute("color", new Float32BufferAttribute(cores, 3));
    g.setAttribute("size", new Float32BufferAttribute(tamanhos, 1));
    return g;
  }, [quantidade]);

  return (
    <points geometry={geometria}>
      <pointsMaterial
        map={textura}
        vertexColors
        size={1.1}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/**
 * As nuvens do cosmos.
 *
 * Planos grandes, longe, sempre de frente para a câmera. Mistura aditiva: elas
 * clareiam o fundo sem cobrir nada, e é isso que dá a sensação de profundidade
 * sem roubar contraste dos planetas.
 */
function Nebulosas() {
  const nuvens = useMemo(
    () =>
      [
        { cor: "#2b4fa8", pos: [-38, 14, -52] as const, escala: 62, op: 0.5 },
        { cor: "#6a2b8a", pos: [44, -10, -58] as const, escala: 54, op: 0.42 },
        { cor: "#1b6e86", pos: [6, 26, -66] as const, escala: 70, op: 0.3 },
        { cor: "#8a3b2b", pos: [-20, -22, -48] as const, escala: 40, op: 0.22 },
      ].map((n, i) => ({ ...n, textura: texturaNebulosa(n.cor, i + 1) })),
    [],
  );

  return (
    <>
      {nuvens.map((n) => (
        <sprite
          key={n.cor}
          position={[n.pos[0], n.pos[1], n.pos[2]]}
          scale={[n.escala, n.escala, 1]}
          raycast={() => null}
        >
          <spriteMaterial
            map={n.textura}
            transparent
            opacity={n.op}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  );
}

/**
 * O céu, que acompanha o cursor.
 *
 * As duas camadas giram um pouco em torno do centro, no sentido contrário ao
 * do ponteiro — e cada uma no seu tanto: as estrelas mais, as nuvens menos. É
 * essa diferença que o olho lê como distância. Os planetas não entram: eles
 * são o que se mira, e alvo que foge do cursor é o que a pausa dos eixos
 * existe para evitar.
 *
 * Os ângulos são pequenos de propósito. O efeito é para ser percebido, não
 * visto: céu que balança a cada gesto enjoa numa tela que se olha por minutos.
 */
function Fundo({ estrelas }: { estrelas: number }) {
  const perto = useRef<Group>(null);
  const longe = useRef<Group>(null);

  useFrame(({ pointer }, delta) => {
    const k = 1 - Math.exp(-2.6 * delta);
    const seguir = (g: Group | null, x: number, y: number) => {
      if (!g) return;
      g.rotation.y += (pointer.x * x - g.rotation.y) * k;
      g.rotation.x += (-pointer.y * y - g.rotation.x) * k;
    };
    seguir(perto.current, 0.05, 0.035);
    seguir(longe.current, 0.022, 0.015);
  });

  return (
    <>
      <group ref={longe}>
        <Nebulosas />
      </group>
      <group ref={perto}>
        <Estrelas quantidade={estrelas} />
      </group>
    </>
  );
}

/**
 * O traço de uma órbita.
 *
 * A opacidade é um ALVO, não um valor: o traço desliza até ele. É o que faz a
 * linha de cada etapa surgir quando a etapa é aberta, em vez de piscar na tela.
 * Com alvo zero ela some de vez (`visible`), para não custar desenho à toa.
 */
function Trilho({
  raio,
  cor,
  opacidade,
}: {
  raio: number;
  cor: string;
  opacidade: number;
}) {
  const linha = useMemo(() => {
    const pontos: number[] = [];
    for (let i = 0; i <= 300; i++) {
      const a = (i / 300) * Math.PI * 2;
      pontos.push(Math.cos(a) * raio, 0, Math.sin(a) * raio);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pontos, 3));
    const l = new Line(
      g,
      new LineBasicMaterial({ color: cor, transparent: true, opacity: 0 }),
    );
    l.visible = false;
    return l;
  }, [raio, cor]);

  useFrame((_, delta) => {
    const material = linha.material as LineBasicMaterial;
    material.opacity +=
      (opacidade - material.opacity) * (1 - Math.exp(-5 * delta));
    linha.visible = material.opacity > 0.004;
  });

  return <primitive object={linha} />;
}

/**
 * O alvo invisível de cada órbita.
 *
 * A linha da órbita tem um pixel de espessura: ninguém acerta isso com o
 * cursor. Este disco fino, transparente e no mesmo plano, é o que recebe o
 * hover e o clique — o traço continua sendo só o desenho.
 *
 * `visible` tem de ficar true: objeto invisível é pulado pelo raycaster. Quem
 * some é o material, com opacidade zero.
 *
 * A faixa é generosa (±1 unidade) porque o traço tem um pixel: com a faixa do
 * tamanho do desenho, ninguém acerta. Os planetas ficam por cima na ordem do
 * raycaster — a esfera está mais perto da câmera que o plano.
 */
function AnelSensivel({
  raio,
  aoEntrar,
  aoSair,
  aoClicar,
}: {
  raio: number;
  aoEntrar: () => void;
  aoSair: () => void;
  aoClicar: () => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: `mesh` é objeto three.js, não elemento do DOM; o caminho acessível é a lista de órbitas em HTML, sempre renderizada em `Jornada`.
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        aoEntrar();
      }}
      onPointerOut={aoSair}
      onClick={(e) => {
        e.stopPropagation();
        aoClicar();
      }}
    >
      <ringGeometry args={[raio - 1.05, raio + 1.05, 96]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

const VERTICE_ATMOSFERA = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vOlhar;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vOlhar = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENTO_ATMOSFERA = /* glsl */ `
  uniform vec3 uCor;
  uniform float uForca;
  varying vec3 vNormal;
  varying vec3 vOlhar;
  void main() {
    // Quanto mais rasante o olhar, mais ar a luz atravessa: o brilho mora na
    // borda do disco e some no meio.
    float borda = 1.0 - max(dot(normalize(vNormal), normalize(vOlhar)), 0.0);
    float brilho = pow(borda, 2.4) * uForca;
    gl_FragColor = vec4(uCor * brilho, brilho);
  }
`;

/**
 * A casca de ar em volta do planeta.
 *
 * É ela que descola a esfera do fundo preto: sem a borda acesa, o lado na
 * sombra se funde com o espaço e o planeta vira uma meia-lua recortada.
 */
function Atmosfera({ cor, forca }: { cor: string; forca: number }) {
  // A força entra pelo efeito, não aqui: recriar o material a cada mudança de
  // foco jogaria fora o programa já compilado.
  const uniforms = useMemo(
    () => ({ uCor: { value: new Color(cor) }, uForca: { value: 0 } }),
    [cor],
  );
  useEffect(() => {
    uniforms.uForca.value = forca;
  }, [uniforms, forca]);

  return (
    <mesh scale={1.035} raycast={() => null}>
      <sphereGeometry args={[1, 48, 48]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTICE_ATMOSFERA}
        fragmentShader={FRAGMENTO_ATMOSFERA}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

/** As faixas do anel: raio interno, raio externo e peso da opacidade. */
const FAIXAS_DO_ANEL = [
  [1.36, 1.6, 0.45],
  [1.64, 1.97, 0.8],
  [2.02, 2.2, 0.32],
] as const;

/** Quanto o planeta da etapa aberta cresce em relação ao tamanho de sempre. */
const CRESCIMENTO = 1.4;
/** O intervalo entre um planeta e o seguinte da mesma órbita, em segundos. */
const DEFASAGEM_DO_CRESCIMENTO = 0.07;

function Planeta({
  corpo,
  semente,
  parado,
  destaque,
  aoEntrar,
  aoSair,
  aoClicar,
  apagado,
  registrar,
}: {
  corpo: ReturnType<typeof corposDaJornada>[number];
  semente: number;
  parado: boolean;
  /** A etapa deste planeta acabou de ser aberta: ele cresce. */
  destaque: boolean;
  aoEntrar: () => void;
  aoSair: () => void;
  aoClicar: () => void;
  apagado: boolean;
  /* O rótulo em HTML precisa da posição ATUAL: quem registra é o grupo que se
     move, não um invólucro parado em volta dele. */
  registrar: (g: Group | null) => void;
}) {
  const grupo = useRef<Group>(null);
  const esfera = useRef<Mesh>(null);
  const texturas = useMemo(
    () =>
      texturaPlaneta(estiloDaFerramenta(corpo.toolId), corpo.paleta, semente),
    [corpo.toolId, corpo.paleta, semente],
  );
  const angulo = useRef(corpo.anguloInicial);

  /*
    O crescimento é uma mola, não uma interpolação.

    A mola passa um pouco do ponto e volta: é esse excesso que faz o planeta
    "saltar" quando a etapa abre, em vez de só inchar. Cada planeta da órbita
    espera um instante a mais que o anterior, e a etapa se acende em onda.
  */
  const mola = useRef({ escala: corpo.tamanho, velocidade: 0 });
  const troca = useRef({ valor: destaque, em: 0 });
  const atraso =
    Math.max(0, corpo.orbita.tools.indexOf(corpo.toolId)) *
    DEFASAGEM_DO_CRESCIMENTO;

  useFrame(({ clock }, delta) => {
    if (!parado) angulo.current += corpo.velocidade * delta;
    const [x, y, z] = posicao(corpo.raio, angulo.current);
    grupo.current?.position.set(x, y, z);

    if (troca.current.valor !== destaque) {
      troca.current = { valor: destaque, em: clock.elapsedTime };
    }
    // Só o crescer espera a vez; encolher é imediato, para a etapa que ficou
    // para trás não disputar o olhar com a que acabou de abrir.
    const liberado =
      !destaque || clock.elapsedTime - troca.current.em >= atraso;
    const alvo = corpo.tamanho * (destaque && liberado ? CRESCIMENTO : 1);
    // Passo curto: uma aba que volta do segundo plano entrega um `delta`
    // enorme, e a mola explodiria.
    const dt = Math.min(delta, 0.05);
    const m = mola.current;
    m.velocidade += ((alvo - m.escala) * 130 - m.velocidade * 11) * dt;
    m.escala += m.velocidade * dt;
    grupo.current?.scale.setScalar(m.escala);
    // Giro próprio: discreto, só para a textura não parecer adesivo.
    if (esfera.current && !parado) esfera.current.rotation.y += delta * 0.08;
  });

  return (
    <group
      ref={(g) => {
        grupo.current = g;
        registrar(g);
      }}
      name={corpo.toolId}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: `mesh` é objeto three.js, não elemento do DOM — não recebe foco nem leitor de tela. O caminho acessível é a lista de órbitas em HTML, sempre renderizada em `Jornada`, com cada solução como link. */}
      <mesh
        ref={esfera}
        rotation={[0, 0, 0.2]}
        onPointerOver={(e) => {
          e.stopPropagation();
          aoEntrar();
        }}
        onPointerOut={aoSair}
        onClick={(e) => {
          e.stopPropagation();
          aoClicar();
        }}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={texturas.mapa}
          bumpMap={texturas.relevo}
          bumpScale={RELEVO}
          roughness={0.88}
          metalness={0}
          transparent
          opacity={apagado ? 0.16 : 1}
        />
      </mesh>
      <Atmosfera cor={corpo.paleta.claro} forca={apagado ? 0.08 : 0.75} />
      {corpo.anel && (
        // Mais deitado para a câmera do que o plano das órbitas: quase de
        // perfil, o anel virava um risco e não se lia como anel.
        <group rotation={[Math.PI / 2 - 0.52, 0.22, 0]}>
          {FAIXAS_DO_ANEL.map(([interno, externo, peso]) => (
            <mesh key={interno} raycast={() => null}>
              <ringGeometry args={[interno, externo, 96]} />
              <meshBasicMaterial
                color={corpo.paleta.claro}
                side={DoubleSide}
                transparent
                depthWrite={false}
                opacity={(apagado ? 0.14 : 0.85) * peso}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/**
 * Projeta as posições 3D para o overlay de rótulos em HTML.
 *
 * Rótulo em HTML, e não textura: texto desenhado em canvas não é selecionável,
 * não é lido por leitor de tela e borra quando a câmera se aproxima. O preço é
 * esta ponte — uma projeção por quadro, que é barata.
 */
function Projetor({
  alvos,
  aoProjetar,
}: {
  alvos: { id: string; obter: () => Vector3 | null }[];
  aoProjetar: (p: Projecao[]) => void;
}) {
  const { camera, size } = useThree();
  const acumulado = useRef(0);

  useFrame((_, delta) => {
    // 20 atualizações por segundo bastam para o rótulo colar no corpo, e
    // poupam re-render do React a 60fps.
    acumulado.current += delta;
    if (acumulado.current < 0.05) return;
    acumulado.current = 0;
    const v = new Vector3();
    aoProjetar(
      alvos.map(({ id, obter }) => {
        const p = obter();
        if (!p) return { id, x: 0, y: 0, visivel: false };
        v.copy(p).project(camera);
        return {
          id,
          x: (v.x * 0.5 + 0.5) * size.width,
          y: (-v.y * 0.5 + 0.5) * size.height,
          visivel: v.z < 1,
        };
      }),
    );
  });
  return null;
}

/** Os pontos de uma órbita, para medir como ela aparece na tela. */
function anel(raio: number): Vector3[] {
  const pontos: Vector3[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pontos.push(new Vector3(Math.cos(a) * raio, 0, Math.sin(a) * raio));
  }
  return pontos;
}

/**
 * A caixa de uma órbita na tela, em espaço normalizado (de -1 a 1).
 *
 * Medimos a órbita inteira e não só os extremos do eixo: ela é inclinada, a
 * metade próxima da câmera projeta maior que a distante, e nem o ponto mais
 * largo nem o centro da elipse na tela coincidem com os da órbita no espaço.
 */
function medir(camera: PerspectiveCamera, pontos: Vector3[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const p = new Vector3();
  for (const ponto of pontos) {
    p.copy(ponto).project(camera);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    meiaLargura: (maxX - minX) / 2,
    meiaAltura: (maxY - minY) / 2,
    centroY: (maxY + minY) / 2,
  };
}

function posicionar(
  camera: PerspectiveCamera,
  alvo: Vector3,
  direcao: Vector3,
  distancia: number,
) {
  camera.position.copy(alvo).addScaledVector(direcao, distancia);
  camera.lookAt(alvo);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
}

/**
 * Posiciona a câmera pela regra do desenho, não por números fixos.
 *
 * Duas exigências, as duas sobre a órbita externa:
 *
 * 1. **Largura igual à da fileira de cartões.** A distância é ajustada até a
 *    elipse projetada ter, em pixels, a largura da cadeia de etapas.
 * 2. **Centrada no espaço livre.** O canvas ocupa exatamente o que sobra abaixo
 *    da cadeia (e do método, quando ele aparece); a altura do alvo é ajustada
 *    até o centro da elipse cair no centro do canvas. Quando o método some, o
 *    canvas cresce, esta conta roda de novo e a órbita desce para o novo meio.
 *
 * Tudo é medido numa câmera de teste e só refeito quando o canvas muda de
 * tamanho. A cada quadro, a câmera real apenas desliza até o resultado.
 */
function Conducao() {
  const { camera, size } = useThree();
  const olhar = useRef(new Vector3());
  const pronto = useRef(false);

  const destino = useMemo(() => {
    const teste = (camera as PerspectiveCamera).clone();
    teste.aspect = size.width / Math.max(size.height, 1);
    const tangente = Math.tan((teste.fov * Math.PI) / 360);

    const raio = RAIOS[1] ?? 14.4;
    const externa = anel(raio);
    const direcao = new Vector3(...DIRECAO_DA_CAMERA).normalize();
    const alvo = new Vector3(0, 0, 0);

    // Em espaço normalizado, 1 é a borda da tela: a meia-largura da cadeia
    // dividida pela meia-largura do canvas é a própria razão entre as duas.
    const cadeia = Math.min(LARGURA_CADEIA, size.width - PADDING_LATERAL * 2);
    const alvoMeiaLargura = cadeia / Math.max(size.width, 1);

    /*
      O mínimo é travado dentro do laço. Perto demais, a borda próxima da
      órbita passa para trás da câmera, a projeção devolve valores absurdos e
      o ajuste foge para longe sem voltar.
    */
    const minimo = raio * 1.5;
    let distancia = raio * 3;
    for (let i = 0; i < 16; i++) {
      posicionar(teste, alvo, direcao, distancia);
      const m = medir(teste, externa);
      if (!Number.isFinite(m.meiaLargura) || m.meiaLargura < 1e-4) break;

      // Centro primeiro: sobe ou desce o conjunto até a elipse ficar no meio.
      alvo.y += m.centroY * distancia * tangente;

      // Depois a largura. A altura só trava em janela baixa demais, para a
      // órbita encolher em vez de ser cortada.
      const fator = Math.max(
        m.meiaLargura / alvoMeiaLargura,
        m.meiaAltura / 0.9,
      );
      if (Math.abs(fator - 1) < 0.002 && Math.abs(m.centroY) < 0.002) break;
      distancia = Math.max(minimo, distancia * fator);
    }

    return {
      alvo,
      posicao: alvo.clone().addScaledVector(direcao, distancia),
    };
  }, [camera, size]);

  useFrame((_, delta) => {
    // O primeiro quadro já nasce no lugar; depois disso, desliza. Sem isto a
    // cena abriria com a câmera viajando do zero até o enquadramento.
    const t = pronto.current ? 1 - Math.exp(-3 * delta) : 1;
    pronto.current = true;
    camera.position.lerp(destino.posicao, t);
    olhar.current.lerp(destino.alvo, t);
    camera.lookAt(olhar.current);
  });
  return null;
}

export type CenaProps = {
  /** Suspende o giro — ligado quando o cursor se move. */
  parado: boolean;
  /** Id da ferramenta sob o cursor, ou null. */
  focado: string | null;
  aoFocar: (id: string | null) => void;
  aoAbrir: (href: string) => void;
  aoProjetar: (p: Projecao[]) => void;
  estrelas: number;
  /** Órbita em foco (`1`..`5`), ou null quando a cena está aberta. */
  orbitaAtiva: number | null;
  /** Quantas órbitas já têm o traço à mostra: 0 no começo, 5 no fim. */
  orbitasReveladas: number;
  /** A órbita da etapa recém-aberta, cujos planetas crescem; null se nenhuma. */
  orbitaEmDestaque: number | null;
  /** Órbita sob o cursor — o nome aparece no canto da tela. */
  aoApontarOrbita: (n: number | null) => void;
  /** Clique no traço da órbita: salta para o passo dela. */
  aoEscolherOrbita: (n: number) => void;
};

export function Cena({
  parado,
  focado,
  aoFocar,
  aoAbrir,
  aoProjetar,
  estrelas,
  orbitaAtiva,
  orbitasReveladas,
  orbitaEmDestaque,
  aoApontarOrbita,
  aoEscolherOrbita,
}: CenaProps) {
  const corpos = useMemo(
    () =>
      corposDaJornada((id) => {
        const t = findTool(id);
        return t ? { name: t.name, tagline: t.tagline, href: t.href } : null;
      }),
    [],
  );

  // Avisa quem estiver cobrindo a tela que já há o que mostrar. No terceiro
  // quadro, e não no primeiro: é no primeiro desenho que as texturas sobem
  // para a placa, e é esse o engasgo que a cortina precisa esperar passar.
  const quadros = useRef(0);
  useFrame(() => {
    if (quadros.current > 3) return;
    quadros.current += 1;
    if (quadros.current === 3) window.dispatchEvent(new Event(CENA_PRONTA));
  });

  // O grupo de cada corpo, para o projetor saber onde ele está AGORA.
  const refs = useRef(new Map<string, Group>());
  const baseDoCentro = useMemo(() => new Vector3(), []);
  const alvos = useMemo(
    () => [
      ...corpos.map((c) => ({
        id: c.toolId,
        obter: () => refs.current.get(c.toolId)?.position ?? null,
      })),
      /*
        O nome da órbita NÃO é projetado na cena.

        Cinco elipses concêntricas têm os topos quase no mesmo ponto da tela, e
        qualquer colocação que tentei acabava cruzando o destino ou um planeta.
        O nome passou para o canto da tela, acionado pelo cursor sobre o traço:
        um de cada vez, sempre legível.
      */
      // O nome do centro se apoia embaixo do disco do Astro, não sobre o
      // rosto dele; quem sabe onde é "embaixo" a cada quadro é o próprio disco.
      { id: "destino", obter: () => baseDoCentro },
    ],
    [corpos, baseDoCentro],
  );

  return (
    <>
      <Conducao />
      {/*
        Um sol, de cima e da esquerda.

        A luz antiga vinha de toda parte — ambiente forte, um ponto no centro e
        outra de frente — e por isso nenhum planeta tinha lado escuro: sem
        sombra não há volume, só um disco colorido. Agora a luz principal tem
        direção, o ambiente só impede o lado da noite de sumir no preto, e uma
        contraluz azul fraca desenha a borda oposta.
      */}
      <ambientLight intensity={0.42} color="#5d7fb5" />
      <directionalLight
        position={[-16, 15, 12]}
        intensity={2.9}
        color="#fff1dc"
      />
      <directionalLight
        position={[14, -3, -10]}
        intensity={0.6}
        color="#4f7fd0"
      />
      <Fundo estrelas={estrelas} />

      {ORBITAS.map((o) => {
        const revelada = o.n <= orbitasReveladas;
        return (
          <group key={o.id}>
            <Trilho
              raio={RAIOS[o.n] ?? 6}
              cor={o.color}
              opacidade={
                !revelada
                  ? 0
                  : orbitaAtiva !== null && orbitaAtiva !== o.n
                    ? 0.12
                    : 0.65
              }
            />
            {/* Órbita ainda fechada não responde ao cursor: o clique no
                traço pularia a sequência que os cartões travam. */}
            {revelada && (
              <AnelSensivel
                raio={RAIOS[o.n] ?? 6}
                aoEntrar={() => aoApontarOrbita(o.n)}
                aoSair={() => aoApontarOrbita(null)}
                aoClicar={() => aoEscolherOrbita(o.n)}
              />
            )}
          </group>
        );
      })}

      <AstroCentro
        base={baseDoCentro}
        aoEntrar={() => orbitasReveladas >= 5 && aoApontarOrbita(5)}
        aoSair={() => aoApontarOrbita(null)}
        aoClicar={() => orbitasReveladas >= 5 && aoEscolherOrbita(5)}
        apagado={orbitaAtiva !== null && orbitaAtiva !== 5}
      />

      {corpos.map((corpo, i) => (
        <Planeta
          key={corpo.toolId}
          corpo={corpo}
          semente={i + 1}
          parado={parado}
          destaque={corpo.orbita.n === orbitaEmDestaque}
          apagado={
            (focado !== null && focado !== corpo.toolId) ||
            (orbitaAtiva !== null && corpo.orbita.n !== orbitaAtiva)
          }
          aoEntrar={() => aoFocar(corpo.toolId)}
          aoSair={() => aoFocar(null)}
          aoClicar={() => aoAbrir(corpo.href)}
          registrar={(g) => {
            if (g) refs.current.set(corpo.toolId, g);
            else refs.current.delete(corpo.toolId);
          }}
        />
      ))}

      <Projetor alvos={alvos} aoProjetar={aoProjetar} />
    </>
  );
}

/** O Canvas, já com a câmera da jornada. */
export function CanvasJornada(props: CenaProps & { dpr: [number, number] }) {
  const { dpr, ...cena } = props;
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0.4, 6.6, 23.4], fov: 40 }}
      // `Conducao` assume a posição a partir do primeiro quadro.
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Cena {...cena} />
    </Canvas>
  );
}

/** Mantém a câmera olhando para o destino quando a tela muda de proporção. */
export function useOlharCentro() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto;
}

export { ACHATAMENTO };
