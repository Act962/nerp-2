"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  type Group,
  LinearFilter,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { RAIO_DO_CENTRO } from "./geometria";
import { texturaDeFrente } from "./texturas";

/**
 * O ASTRO no centro da jornada — o mesmo da Início da plataforma.
 *
 * O desenho e os números vêm de lá (`features/astro/components/astro-mark.tsx`
 * no repositório do produto): arco, lua e olhos em vetor, cada um seguindo o
 * cursor com o próprio alcance e o próprio atraso. É essa diferença que dá
 * profundidade — o arco vai longe, os olhos vão um pouco além dele, e a lua,
 * lenta, parece estar atrás.
 *
 * Aqui ele não é HTML por cima da cena: é um corpo DENTRO dela, pintado num
 * canvas a cada quadro. Os planetas da órbita 5 passam na frente e atrás do
 * centro; um elemento flutuando sobre o canvas ficaria sempre na frente e
 * engoliria o planeta que cruza por diante.
 *
 * E é uma esfera, não um disco — só nesta página. Na plataforma ele é um botão
 * chapado; aqui ele divide a cena com planetas que têm superfície, lado claro
 * e lado escuro, e um disco de cor lisa entre eles parecia um adesivo colado
 * na tela. O rosto é projetado em linha reta sobre a esfera (ver `geometria`
 * abaixo), então continua com o desenho da marca; quem muda é a luz.
 *
 * Os satélites e o botão "+" da Início ficaram de fora: lá eles são as
 * integrações da conta; aqui quem orbita o centro são as soluções.
 */

/** O lado do desenho original, em unidades do viewBox. */
const VISTA = 1438.5;
const LADO_DA_TELA = 512;

const CENTRO_ESQ = { x: 551.06, y: 750.42 };
const CENTRO_DIR = { x: 810.07, y: 750.42 };
const OLHO_MEIA_LARGURA = 64.2;
const OLHO_MEIA_ALTURA = 135;

const ALCANCE_X = 160;
const ALCANCE_Y = 132;

const ARCO_CENTRO = { x: 685.7, y: 734.9 };
const ARCO_RAIO_EXTERNO = 461.7;
const ARCO_RAIO_INTERNO = 367.3;
/** Pontas cortadas na diagonal: o vão fica no alto, à direita. */
const ARCO_INICIO_FORA_GRAUS = 3.6;
const ARCO_INICIO_DENTRO_GRAUS = 8.1;
const ARCO_FIM_FORA_GRAUS = 288.7;
const ARCO_FIM_DENTRO_GRAUS = 284.1;
const LUA_CENTRO = { x: 1027.6, y: 504.6 };
const LUA_RAIO = 151.6;
const COR_DO_CORPO = "#f7f7f7";
const COR_DOS_OLHOS = "#fefefe";
/** O degradê do disco: sky-500 → blue-700, do canto de cima para o de baixo. */
const DISCO_DE = "#00a6f4";
const DISCO_ATE = "#1447e6";
/** A superfície por baixo do rosto, nos azuis da marca. */
const PALETA_DA_SUPERFICIE = {
  base: "#0f86ee",
  escuro: "#1447e6",
  claro: "#46c2ff",
};
/** Quanto da superfície aparece sobre o degradê: textura, não outra cor. */
const PESO_DA_SUPERFICIE = 0.55;
/** Mais baixo que o dos planetas: relevo forte enrugaria o rosto. */
const RELEVO_DO_ASTRO = 1.3;

const ARCO_ALCANCE_X = 80;
const ARCO_ALCANCE_Y = 66;
const LUA_ALCANCE_X = 118;
const LUA_ALCANCE_Y = 98;
const SEGUIR_OLHAR = 0.12;
const SEGUIR_ARCO = 0.07;
const SEGUIR_LUA = 0.045;
/** Distância máxima entre olhos e arco: é o que impede um de encostar no outro. */
const FOLGA_OLHOS_ARCO = 100;
const LUA_ORBITA_RAIO = 9;
const LUA_ORBITA_PERIODO = 6200;

/** A que distância o olhar já está no limite, em tamanhos do próprio disco. */
const SATURACAO_EM_DISCOS = 1.25;
const SATURACAO_MINIMA_PX = 90;

const DURACAO_DA_PISCADA = 170;
/** A pausa entre piscadas é sorteada — regular demais vira robô. */
const PISCADA_MIN = 2600;
const PISCADA_MAX = 6400;

/** A alegria: o olho fecha um pouco e engorda, como quem sorri com os olhos. */
const ALEGRE_ACHATA = 0.42;
const ALEGRE_ENGORDA = 0.16;

const PERIODO_DA_FLUTUACAO = 4500;
/** Em unidades da cena: uns quatro pixels para cima e para baixo. */
const ALTURA_DA_FLUTUACAO = 0.1;

function pontoDoArco(graus: number, raio: number) {
  const radianos = (graus * Math.PI) / 180;
  return `${(ARCO_CENTRO.x + raio * Math.cos(radianos)).toFixed(1)} ${(ARCO_CENTRO.y + raio * Math.sin(radianos)).toFixed(1)}`;
}

/** Borda de fora no sentido horário, ponta, borda de dentro de volta, ponta. */
const ARCO_TRACADO = [
  `M ${pontoDoArco(ARCO_INICIO_FORA_GRAUS, ARCO_RAIO_EXTERNO)}`,
  `A ${ARCO_RAIO_EXTERNO} ${ARCO_RAIO_EXTERNO} 0 1 1 ${pontoDoArco(ARCO_FIM_FORA_GRAUS, ARCO_RAIO_EXTERNO)}`,
  `L ${pontoDoArco(ARCO_FIM_DENTRO_GRAUS, ARCO_RAIO_INTERNO)}`,
  `A ${ARCO_RAIO_INTERNO} ${ARCO_RAIO_INTERNO} 0 1 0 ${pontoDoArco(ARCO_INICIO_DENTRO_GRAUS, ARCO_RAIO_INTERNO)}`,
  "Z",
].join(" ");

function proximaPiscada(agora: number) {
  return agora + PISCADA_MIN + Math.random() * (PISCADA_MAX - PISCADA_MIN);
}

type Rosto = {
  olharX: number;
  olharY: number;
  arcoX: number;
  arcoY: number;
  luaX: number;
  luaY: number;
  /** Altura dos olhos, de 0 (fechados) a 1. */
  olhoY: number;
  /** Largura dos olhos: 1 em repouso, um pouco mais quando alegre. */
  olhoX: number;
};

const REPOUSO: Rosto = {
  olharX: 0,
  olharY: 0,
  arcoX: 0,
  arcoY: 0,
  luaX: 0,
  luaY: 0,
  olhoY: 1,
  olhoX: 1,
};

/** O degradê da marca com a superfície por cima — pintado uma vez só. */
function pintarFundo(superficie: HTMLCanvasElement): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  tela.width = LADO_DA_TELA;
  tela.height = LADO_DA_TELA;
  const x = tela.getContext("2d");
  if (!x) return tela;
  // O quadrado inteiro: quem recorta o círculo é a esfera.
  const degrade = x.createLinearGradient(0, 0, LADO_DA_TELA, LADO_DA_TELA);
  degrade.addColorStop(0, DISCO_DE);
  degrade.addColorStop(1, DISCO_ATE);
  x.fillStyle = degrade;
  x.fillRect(0, 0, LADO_DA_TELA, LADO_DA_TELA);
  x.globalAlpha = PESO_DA_SUPERFICIE;
  x.drawImage(superficie, 0, 0, LADO_DA_TELA, LADO_DA_TELA);
  return tela;
}

function desenhar(
  x: CanvasRenderingContext2D,
  fundo: HTMLCanvasElement,
  arco: Path2D,
  rosto: Rosto,
) {
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.drawImage(fundo, 0, 0);
  const k = LADO_DA_TELA / VISTA;
  x.setTransform(k, 0, 0, k, 0, 0);

  x.fillStyle = COR_DO_CORPO;
  x.save();
  x.translate(rosto.arcoX, rosto.arcoY);
  x.fill(arco);
  x.restore();

  x.beginPath();
  x.arc(
    LUA_CENTRO.x + rosto.luaX,
    LUA_CENTRO.y + rosto.luaY,
    LUA_RAIO,
    0,
    Math.PI * 2,
  );
  x.fill();

  x.fillStyle = COR_DOS_OLHOS;
  for (const centro of [CENTRO_ESQ, CENTRO_DIR]) {
    x.save();
    x.translate(centro.x + rosto.olharX, centro.y + rosto.olharY);
    x.scale(rosto.olhoX, rosto.olhoY);
    x.beginPath();
    x.roundRect(
      -OLHO_MEIA_LARGURA,
      -OLHO_MEIA_ALTURA,
      OLHO_MEIA_LARGURA * 2,
      OLHO_MEIA_ALTURA * 2,
      OLHO_MEIA_LARGURA,
    );
    x.fill();
    x.restore();
  }
}

export function AstroCentro({
  aoEntrar,
  aoSair,
  aoClicar,
  apagado,
  base,
}: {
  aoEntrar: () => void;
  aoSair: () => void;
  aoClicar: () => void;
  apagado: boolean;
  /** Recebe, a cada quadro, o ponto de baixo do disco — onde o nome se apoia. */
  base: Vector3;
}) {
  const { camera, gl } = useThree();
  const grupo = useRef<Group>(null);

  const pintura = useMemo(() => {
    const tela = document.createElement("canvas");
    tela.width = LADO_DA_TELA;
    tela.height = LADO_DA_TELA;
    const contexto = tela.getContext("2d");
    const arco = new Path2D(ARCO_TRACADO);
    const superficie = texturaDeFrente(
      "gelado",
      PALETA_DA_SUPERFICIE,
      5,
      LADO_DA_TELA,
    );
    const fundo = pintarFundo(superficie.cor);
    if (contexto) desenhar(contexto, fundo, arco, REPOUSO);
    const textura = new CanvasTexture(tela);
    textura.colorSpace = SRGBColorSpace;
    // Repintada a cada quadro: mipmap seria refeito sessenta vezes por segundo.
    textura.generateMipmaps = false;
    textura.minFilter = LinearFilter;
    return { contexto, fundo, arco, textura, relevo: superficie.relevo };
  }, []);

  /*
    Uma esfera com a textura projetada de frente.

    O UV padrão da esfera enrola a imagem em volta dela, e o rosto sairia
    esticado de polo a polo. Aqui cada vértice recebe a própria posição x/y
    como coordenada: a imagem cai reta sobre o hemisfério voltado para a
    câmera, como um projetor. As NORMAIS continuam as da esfera — é delas que
    sai o lado claro, o lado escuro e a linha de sombra entre os dois.
  */
  const geometria = useMemo(() => {
    const g = new SphereGeometry(RAIO_DO_CENTRO, 96, 64);
    const posicoes = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < posicoes.count; i++) {
      uv.setXY(
        i,
        posicoes.getX(i) / (RAIO_DO_CENTRO * 2) + 0.5,
        posicoes.getY(i) / (RAIO_DO_CENTRO * 2) + 0.5,
      );
    }
    uv.needsUpdate = true;
    return g;
  }, []);

  useEffect(
    () => () => {
      pintura.textura.dispose();
      pintura.relevo.dispose();
      geometria.dispose();
    },
    [pintura, geometria],
  );

  // O estado do rosto mora fora do React: ele muda a 60fps.
  const vivo = useRef({
    ...REPOUSO,
    alvoX: 0,
    alvoY: 0,
    alegria: 0,
    sobOCursor: false,
    piscaEm: 0,
    piscandoDesde: 0,
    parado: false,
    temPonteiro: false,
  });

  useEffect(() => {
    const estado = vivo.current;
    estado.parado = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Sem cursor não há o que seguir: no toque, o Astro só pisca e flutua.
    estado.temPonteiro = window.matchMedia("(pointer: fine)").matches;
    estado.piscaEm = proximaPiscada(performance.now());
    if (estado.parado || !estado.temPonteiro) return;

    const centro = new Vector3();
    const borda = new Vector3();
    const aoMover = (evento: PointerEvent) => {
      const caixa = gl.domElement.getBoundingClientRect();
      const g = grupo.current;
      if (!g || caixa.width === 0) return;

      // Onde o disco está NA TELA, e com que largura: é contra isso que o
      // cursor é medido, como na plataforma — perto dele, o olhar satura logo.
      centro.copy(g.position).project(camera);
      borda
        .setFromMatrixColumn(camera.matrixWorld, 0)
        .multiplyScalar(RAIO_DO_CENTRO)
        .add(g.position)
        .project(camera);
      const cx = caixa.left + (centro.x * 0.5 + 0.5) * caixa.width;
      const cy = caixa.top + (-centro.y * 0.5 + 0.5) * caixa.height;
      const largura = Math.abs(borda.x - centro.x) * caixa.width;
      const saturacao = Math.max(
        largura * SATURACAO_EM_DISCOS,
        SATURACAO_MINIMA_PX,
      );
      const limite = (valor: number) =>
        Math.max(-1, Math.min(1, valor / saturacao));

      estado.alvoX = limite(evento.clientX - cx) * ALCANCE_X;
      estado.alvoY = limite(evento.clientY - cy) * ALCANCE_Y;
    };

    window.addEventListener("pointermove", aoMover, { passive: true });
    return () => window.removeEventListener("pointermove", aoMover);
  }, [camera, gl]);

  const cima = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const g = grupo.current;
    if (!g) return;
    const estado = vivo.current;
    const agora = performance.now();

    // Sempre de frente: é um rosto, não um corpo que gira.
    g.quaternion.copy(camera.quaternion);
    cima.setFromMatrixColumn(camera.matrixWorld, 1);
    const flutua = estado.parado
      ? 0
      : Math.sin((agora / PERIODO_DA_FLUTUACAO) * Math.PI * 2) *
        ALTURA_DA_FLUTUACAO;
    g.position.copy(cima).multiplyScalar(flutua);
    base.copy(cima).multiplyScalar(flutua - RAIO_DO_CENTRO);

    if (estado.parado || !pintura.contexto) return;

    // 1. o olhar persegue o ponteiro com atraso — é o que faz parecer olhar,
    //    e não espelhar o mouse.
    estado.olharX += (estado.alvoX - estado.olharX) * SEGUIR_OLHAR;
    estado.olharY += (estado.alvoY - estado.olharY) * SEGUIR_OLHAR;

    // 2. o arco segue o mesmo alvo, mais devagar; a trava mantém a folga.
    estado.arcoX +=
      ((estado.alvoX / ALCANCE_X) * ARCO_ALCANCE_X - estado.arcoX) *
      SEGUIR_ARCO;
    estado.arcoY +=
      ((estado.alvoY / ALCANCE_Y) * ARCO_ALCANCE_Y - estado.arcoY) *
      SEGUIR_ARCO;
    const dx = estado.arcoX - estado.olharX;
    const dy = estado.arcoY - estado.olharY;
    const distancia = Math.hypot(dx, dy);
    if (distancia > FOLGA_OLHOS_ARCO) {
      estado.arcoX = estado.olharX + (dx / distancia) * FOLGA_OLHOS_ARCO;
      estado.arcoY = estado.olharY + (dy / distancia) * FOLGA_OLHOS_ARCO;
    }

    // 3. a lua: a mais lenta, com uma órbita pequena que nunca para.
    const luaAlvoX = (estado.alvoX / ALCANCE_X) * LUA_ALCANCE_X;
    const luaAlvoY = (estado.alvoY / ALCANCE_Y) * LUA_ALCANCE_Y;
    estado.luaX += (luaAlvoX - estado.luaX) * SEGUIR_LUA;
    estado.luaY += (luaAlvoY - estado.luaY) * SEGUIR_LUA;
    const fase = (agora / LUA_ORBITA_PERIODO) * Math.PI * 2;

    // 4. a alegria, só sob o cursor.
    const querAlegria = estado.temPonteiro && estado.sobOCursor;
    estado.alegria += ((querAlegria ? 1 : 0) - estado.alegria) * 0.18;

    // 5. a piscada: a altura vai a zero e volta, num cosseno só.
    let piscada = 1;
    if (estado.piscandoDesde) {
      const progresso = (agora - estado.piscandoDesde) / DURACAO_DA_PISCADA;
      if (progresso >= 1) {
        estado.piscandoDesde = 0;
        estado.piscaEm = proximaPiscada(agora);
      } else {
        piscada = Math.abs(Math.cos(progresso * Math.PI));
      }
    } else if (agora >= estado.piscaEm) {
      estado.piscandoDesde = agora;
    }

    desenhar(pintura.contexto, pintura.fundo, pintura.arco, {
      olharX: estado.olharX,
      olharY: estado.olharY,
      arcoX: estado.arcoX,
      arcoY: estado.arcoY,
      luaX: estado.luaX + Math.cos(fase) * LUA_ORBITA_RAIO,
      luaY: estado.luaY + Math.sin(fase) * LUA_ORBITA_RAIO,
      olhoY: piscada * (1 - ALEGRE_ACHATA * estado.alegria),
      olhoX: 1 + ALEGRE_ENGORDA * estado.alegria,
    });
    pintura.textura.needsUpdate = true;
  });

  return (
    <group ref={grupo}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: `mesh` é objeto three.js, não elemento do DOM — não recebe foco nem leitor de tela. O caminho acessível é a lista de órbitas em HTML, sempre renderizada em `Jornada`. */}
      <mesh
        geometry={geometria}
        onPointerOver={(e) => {
          e.stopPropagation();
          vivo.current.sobOCursor = true;
          aoEntrar();
        }}
        onPointerOut={() => {
          vivo.current.sobOCursor = false;
          aoSair();
        }}
        onClick={(e) => {
          e.stopPropagation();
          aoClicar();
        }}
      >
        {/* Iluminado pelo mesmo sol dos planetas: é o que dá a ele lado
            claro e lado escuro, em vez de um azul igual de ponta a ponta. */}
        <meshStandardMaterial
          map={pintura.textura}
          bumpMap={pintura.relevo}
          bumpScale={RELEVO_DO_ASTRO}
          roughness={0.82}
          metalness={0}
          // Um fio de luz própria, com o mesmo desenho: sem ele o branco do
          // rosto sai cinza sob o tone mapping e some no lado da sombra. É
          // pouco de propósito — o volume continua vindo do sol.
          emissive="#ffffff"
          emissiveMap={pintura.textura}
          emissiveIntensity={apagado ? 0 : 0.2}
          transparent
          opacity={apagado ? 0.16 : 1}
        />
      </mesh>
    </group>
  );
}
