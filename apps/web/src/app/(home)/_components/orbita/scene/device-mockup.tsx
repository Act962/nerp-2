"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  Color,
  type Group,
  LinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import { scroll } from "../lib/store";
import { clamp, damp, smoothstep } from "../lib/cn";
import type { Feature } from "../data/catalog";

/**
 * O item flutuante: notebook e celular na frente da esfera.
 *
 * A tela não é uma imagem: é um canvas desenhado em código, com um leiaute
 * diferente por funcionalidade. Isso resolve dois problemas de uma vez — não
 * depende de nenhum print existir, e o conteúdo troca de verdade quando a
 * roleta gira, em vez de repetir a mesma figura com outro rótulo por baixo.
 *
 * Quando os screenshots reais existirem, é só trocar a textura do canvas por
 * uma `TextureLoader` — o resto da cena não muda.
 */

const SCREEN_W = 1024;
const SCREEN_H = 640;

/** Desenha uma interface abstrata: o leiaute varia com o índice. */
function drawScreen(
  ctx: CanvasRenderingContext2D,
  feature: Feature | undefined,
  index: number,
) {
  const w = SCREEN_W;
  const h = SCREEN_H;

  ctx.clearRect(0, 0, w, h);

  // Fundo
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#071426");
  bg.addColorStop(1, "#03080f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const blue = "#0a93f7";
  const bright = "#3db4ff";
  const dim = "rgba(150, 185, 225, 0.28)";

  // Barra lateral
  ctx.fillStyle = "rgba(10, 30, 58, 0.75)";
  ctx.fillRect(0, 0, 108, h);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i === index % 6 ? blue : "rgba(140, 180, 225, 0.22)";
    ctx.beginPath();
    ctx.roundRect(34, 74 + i * 62, 40, 40, 11);
    ctx.fill();
  }

  // Topo
  ctx.fillStyle = "rgba(160, 195, 235, 0.16)";
  ctx.beginPath();
  ctx.roundRect(146, 44, 300, 22, 11);
  ctx.fill();
  ctx.fillStyle = "rgba(160, 195, 235, 0.1)";
  ctx.beginPath();
  ctx.roundRect(w - 220, 44, 170, 22, 11);
  ctx.fill();

  // Título da funcionalidade
  ctx.fillStyle = "#eaf4ff";
  ctx.font = "600 40px Inter, system-ui, sans-serif";
  ctx.fillText(feature?.title ?? "", 146, 132);

  const variant = index % 4;

  if (variant === 0) {
    // Kanban
    for (let c = 0; c < 3; c++) {
      const x = 150 + c * 250;
      ctx.fillStyle = "rgba(140, 180, 225, 0.08)";
      ctx.beginPath();
      ctx.roundRect(x, 176, 220, h - 232, 16);
      ctx.fill();
      for (let r = 0; r < 3 - c; r++) {
        ctx.fillStyle = c === 0 && r === 0 ? blue : "rgba(160, 200, 240, 0.2)";
        ctx.beginPath();
        ctx.roundRect(x + 16, 200 + r * 96, 188, 76, 12);
        ctx.fill();
      }
    }
  } else if (variant === 1) {
    // Indicadores + gráfico de área
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle =
        i === 0 ? "rgba(10, 147, 247, 0.25)" : "rgba(140, 180, 225, 0.09)";
      ctx.beginPath();
      ctx.roundRect(150 + i * 190, 176, 170, 96, 14);
      ctx.fill();
      ctx.fillStyle = i === 0 ? bright : dim;
      ctx.beginPath();
      ctx.roundRect(168 + i * 190, 214, 90, 20, 10);
      ctx.fill();
    }
    const base = h - 60;
    ctx.beginPath();
    ctx.moveTo(150, base);
    for (let i = 0; i <= 20; i++) {
      const x = 150 + (i / 20) * (w - 210);
      const y = base - 60 - Math.sin(i * 0.5 + index) * 30 - i * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w - 60, base);
    ctx.closePath();
    const area = ctx.createLinearGradient(0, 300, 0, base);
    area.addColorStop(0, "rgba(10, 147, 247, 0.5)");
    area.addColorStop(1, "rgba(10, 147, 247, 0)");
    ctx.fillStyle = area;
    ctx.fill();
  } else if (variant === 2) {
    // Conversa
    for (let i = 0; i < 5; i++) {
      const mine = i % 2 === 1;
      const bw = 220 + (i % 3) * 90;
      ctx.fillStyle = mine ? blue : "rgba(150, 190, 230, 0.16)";
      ctx.beginPath();
      ctx.roundRect(mine ? w - bw - 60 : 150, 188 + i * 78, bw, 58, 18);
      ctx.fill();
    }
  } else {
    // Lista com linhas
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle =
        i === 1 ? "rgba(10, 147, 247, 0.22)" : "rgba(140, 180, 225, 0.07)";
      ctx.beginPath();
      ctx.roundRect(150, 180 + i * 66, w - 210, 52, 12);
      ctx.fill();
      ctx.fillStyle = i === 1 ? bright : dim;
      ctx.beginPath();
      ctx.roundRect(172, 198 + i * 66, 160 + (i % 3) * 70, 16, 8);
      ctx.fill();
    }
  }
}

export function DeviceMockup({ features }: { features: Feature[] }) {
  const group = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const drawn = useRef(-1);

  const { texture, context } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const ctx = canvas.getContext("2d");
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    return { texture: tex, context: ctx };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  const screenMaterial = useMemo(
    () => new MeshBasicMaterial({ map: texture, toneMapped: false }),
    [texture],
  );

  const shell = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#161c26"),
        roughness: 0.42,
        metalness: 0.4,
        // Sem um brilho próprio o corpo vira um vulto preto: a luz do modo
        // produto é fraca e o notebook fica à sombra da própria esfera.
        emissive: new Color("#0c1c31"),
        emissiveIntensity: 0.9,
      }),
    [],
  );

  const toCamera = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);
  const state = useRef({ swap: 0 });

  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.12);

    const open = smoothstep(clamp(scroll.product.t));
    g.visible = open > 0.02;
    if (!g.visible) return;

    // Redesenha a tela quando a roleta troca de item.
    const index = Math.round(scroll.product.feature);
    if (index !== drawn.current && context) {
      drawn.current = index;
      drawScreen(context, features[index], index);
      texture.needsUpdate = true;
      state.current.swap = 1;
    }
    state.current.swap = damp(state.current.swap, 0, 5, dt);

    /*
      O device acompanha a esfera pelo referencial da câmera.

      Posicioná-lo em coordenadas de mundo exigiria refazer a conta a cada
      ângulo da órbita. Ancorando-o nos eixos da câmera, ele fica sempre no
      mesmo lugar do quadro — à frente e abaixo do centro da esfera —
      independentemente de onde o nó esteja na trajetória.
    */
    camera.getWorldDirection(toCamera);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    const anchor = scroll.orbWorld;
    const radius = scroll.orbScale;

    g.position
      .set(anchor.x, anchor.y, anchor.z)
      .addScaledVector(right, radius * 0.52)
      .addScaledVector(up, -radius * 0.32)
      /*
        Um raio inteiro à frente não basta.

        O notebook tem profundidade própria: a tampa fica atrás do ponto de
        ancoragem e entrava na esfera, que a cortava numa curva preta. A folga
        precisa cobrir o raio mais a meia-profundidade do objeto.
      */
      .addScaledVector(toCamera, -radius * 1.62);

    /*
      Olhar para a câmera, e não copiar a orientação dela.

      Copiar o quaternion deixa o objeto paralelo ao plano da imagem — o que só
      parece frontal no centro do quadro. Como a esfera fica bem à esquerda, a
      perspectiva mostrava o notebook de lado, uma cunha escura. Apontando o
      objeto para a posição da câmera, ele fica frontal onde quer que esteja.
    */
    g.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    g.lookAt(camera.position);
    g.scale.setScalar(radius * 0.56 * open);

    if (inner.current) {
      const t = scroll.time;
      inner.current.position.y = Math.sin(t * 0.7) * 0.02;
      /*
        A inclinação para trás é o que faz o notebook parecer um notebook.
        Sem ela a base fica de perfil — uma linha — e só a tela aparece,
        flutuando sem apoio.
      */
      inner.current.rotation.y = 0.26 + Math.sin(t * 0.35) * 0.05;
      inner.current.rotation.x = -0.2 + Math.cos(t * 0.3) * 0.025;
      // Um empurrãozinho no momento da troca: o objeto reage à roleta.
      inner.current.scale.setScalar(1 + state.current.swap * 0.05);
    }
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        {/* Notebook: base, tampa e tela */}
        {/*
          A base é mais rasa que o teclado de um notebook real.
          Em perspectiva, uma chapa de 0.78 de profundidade abre num leque que
          pesa mais que a tela — e a tela é o que interessa aqui.
        */}
        <mesh
          material={shell}
          position={[0, -0.3, 0.12]}
          rotation={[-0.12, 0, 0]}
        >
          <boxGeometry args={[1.12, 0.032, 0.6]} />
        </mesh>
        <group position={[0, -0.29, -0.2]} rotation={[-0.1, 0, 0]}>
          <mesh material={shell} position={[0, 0.36, -0.012]}>
            <boxGeometry args={[1.15, 0.72, 0.025]} />
          </mesh>
          <mesh material={screenMaterial} position={[0, 0.36, 0.004]}>
            <planeGeometry args={[1.08, 0.66]} />
          </mesh>
        </group>

        {/* Celular à frente, com a mesma tela recortada */}
        <group position={[-0.82, -0.36, 0.52]} rotation={[0.04, 0.5, 0.1]}>
          <mesh material={shell}>
            <boxGeometry args={[0.33, 0.66, 0.022]} />
          </mesh>
          <mesh material={screenMaterial} position={[0, 0, 0.013]}>
            <planeGeometry args={[0.3, 0.61]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
