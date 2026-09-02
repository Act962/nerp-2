"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  Color,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  type PointLight,
  Vector3,
} from "three";
import { orbitAngleAt, orbitPosition } from "../lib/orbit";
import { scroll } from "../lib/store";
import { clamp, damp, smoothstep } from "../lib/cn";

/**
 * A esfera branca em órbita.
 *
 * É o elemento da marca isolado: a mesma matéria do símbolo original —
 * cerâmica branca com verniz por cima, realce especular duro e contorno frio —
 * só que sozinha, ocupando uma posição real na trajetória ao redor do planeta.
 * Quando o ângulo a leva para trás do globo, é o z-buffer que a esconde.
 *
 * A luz é o que responde ao scroll. Duas fontes giram em torno dela conforme a
 * página avança: o realce principal atravessa a superfície de um lado ao outro
 * e o contorno passa de azul-atmosfera a branco-gelo. A esfera não muda —
 * muda a hora do dia sobre ela.
 */

const SPHERE = {
  /** Raio em unidades locais; o tamanho real vem da escala do grupo. */
  radius: 1,
  /** Distância das luzes próprias, em raios. */
  keyDistance: 2.6,
  rimDistance: 2.9,
};

/** Cores do contorno ao longo da viagem: atmosfera → gelo → branco. */
const RIM_STOPS = [
  new Color("#1f7fe0"),
  new Color("#3db4ff"),
  new Color("#8fd4ff"),
  new Color("#dceeff"),
];

function sampleRim(t: number, out: Color) {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const scaled = clamped * (RIM_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), RIM_STOPS.length - 2);
  return out.copy(RIM_STOPS[i]).lerp(RIM_STOPS[i + 1], scaled - i);
}

type Props = {
  /** Raio da esfera em unidades de planeta (raio do planeta = 1). */
  scale?: number;
  glow?: boolean;
  /** No retrato a esfera cresce menos no impacto — a tela é estreita. */
  compact?: boolean;
};

export function OrbitObject({
  scale = 0.3,
  glow = true,
  compact = false,
}: Props) {
  const group = useRef<Group>(null);
  const size = useThree((s) => s.size);
  const keyLight = useRef<PointLight>(null);
  const rimLight = useRef<PointLight>(null);
  const halo = useRef<Mesh>(null);

  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: new Color("#ffffff"),
        // Verniz sobre cerâmica: rugosidade baixa o bastante para o realce
        // ficar pequeno e duro, como no render de referência — uma superfície
        // muito fosca vira uma bola cinza sem direção de luz.
        roughness: 0.17,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        sheen: 0.25,
        sheenColor: new Color("#cfe2ff"),
        emissive: new Color("#070d18"),
        emissiveIntensity: 0.6,
        envMapIntensity: 1.6,
      }),
    [],
  );

  const haloMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color("#9ccdff"),
        transparent: true,
        opacity: 0.12,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
      }),
    [],
  );

  const pos = useMemo(() => new Vector3(), []);
  const rim = useMemo(() => new Color(), []);
  const projA = useMemo(() => new Vector3(), []);
  const projB = useMemo(() => new Vector3(), []);
  const camRight = useMemo(() => new Vector3(), []);
  const state = useRef({ scale: scale * 0.8, glow: 0 });

  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.12);
    const p = scroll.smooth;

    /*
      Durante a abertura quem aparece é o círculo chapado do overlay. A esfera
      real só entra em cena quando o círculo já pousou exatamente sobre ela —
      antes disso seriam duas esferas na tela.
    */
    const handoff = smoothstep(clamp((scroll.intro - 0.88) / 0.12));
    g.visible = handoff > 0.001;

    /*
      1. Posição real na órbita.

      No modo produto a esfera para de percorrer a trajetória e ancora no nó
      que foi aberto — é ela que vira o palco do produto. `product.angle`
      sobrevive ao fechamento para que a volta seja uma interpolação, e não um
      salto de volta ao ângulo do scroll.
    */
    const openT = smoothstep(clamp(scroll.product.t));
    const angle =
      openT > 0
        ? orbitAngleAt(p) * (1 - openT) + scroll.product.angle * openT
        : orbitAngleAt(p);
    orbitPosition(angle, pos);
    g.position.lerp(pos, 1 - Math.exp(-9 * dt));

    // 2. Escala narrativa: discreta no hero, protagonista no impacto.
    const impact = Math.max(0, 1 - Math.abs(p - 0.81) / 0.1);
    const finale = Math.max(0, 1 - Math.abs(p - 0.96) / 0.09);
    const breath = Math.sin(scroll.time * 0.5) * 0.01;
    // No modo produto a esfera assume o quadro: cresce até virar o corpo que
    // sustenta o logotipo e o device.
    const productScale = compact ? 0.44 : 0.66;
    const target =
      scale *
      (0.94 +
        impact * impact * (compact ? 0.5 : 0.85) +
        finale * 0.28 +
        breath +
        openT * productScale);
    state.current.scale = damp(state.current.scale, target, 4.5, dt);
    g.scale.setScalar(state.current.scale);

    // 3. A luz principal dá uma volta e meia em torno da esfera ao longo da
    //    página. É o que faz o realce atravessar a superfície enquanto se rola.
    // A fase inicial coloca o realce em cima e à direita — o mesmo ponto de luz
    // do render de referência. Daí em diante ele atravessa a esfera.
    const orbitAngle = p * Math.PI * 3 + 1.15;
    const tilt = 0.55 + Math.sin(p * Math.PI * 2) * 0.35;
    if (keyLight.current) {
      keyLight.current.position.set(
        Math.cos(orbitAngle) * SPHERE.keyDistance,
        Math.sin(tilt) * SPHERE.keyDistance * 0.75,
        Math.sin(orbitAngle) * SPHERE.keyDistance,
      );
      keyLight.current.intensity = 11 + impact * 5 + finale * 3;
    }

    // 4. O contorno vem do lado oposto e esfria conforme a viagem avança.
    if (rimLight.current) {
      rimLight.current.position.set(
        -Math.cos(orbitAngle + 0.7) * SPHERE.rimDistance,
        -Math.sin(tilt) * SPHERE.rimDistance * 0.5,
        -Math.sin(orbitAngle + 0.7) * SPHERE.rimDistance,
      );
      rimLight.current.color.copy(sampleRim(p, rim));
      rimLight.current.intensity = 4 + impact * 2.5;
    }

    // 5. O halo respira com os momentos fortes e com a própria velocidade do
    //    scroll — rolar rápido deixa um rastro de luz ao redor da esfera.
    const targetGlow =
      0.09 +
      impact * 0.2 +
      finale * 0.14 +
      Math.min(Math.abs(scroll.velocity), 1) * 0.1;
    state.current.glow = damp(state.current.glow, targetGlow, 3.5, dt);
    haloMaterial.opacity = state.current.glow * handoff;
    if (halo.current) {
      halo.current.scale.setScalar(1.16 + state.current.glow * 0.9);
    }

    material.emissiveIntensity = 0.55 + impact * 0.3 + finale * 0.25;

    /*
      Publica onde a esfera está na tela e com que raio.

      O raio sai da projeção de um segundo ponto deslocado pela direita da
      câmera — medir em pixels é a única forma de o círculo do overlay pousar
      exatamente em cima dela, seja qual for a distância, o fov ou a tela.
    */
    projA.copy(g.position).project(camera);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    projB
      .copy(g.position)
      .addScaledVector(camRight, state.current.scale)
      .project(camera);

    const halfW = size.width / 2;
    const halfH = size.height / 2;
    scroll.orb.x = (projA.x * 0.5 + 0.5) * size.width;
    scroll.orb.y = (-projA.y * 0.5 + 0.5) * size.height;
    scroll.orb.r = Math.hypot(
      (projB.x - projA.x) * halfW,
      (projB.y - projA.y) * halfH,
    );
    scroll.orb.ready = true;

    // O mundo, para quem precisa se ancorar na esfera dentro da cena.
    scroll.orbWorld.x = g.position.x;
    scroll.orbWorld.y = g.position.y;
    scroll.orbWorld.z = g.position.z;
    scroll.orbScale = state.current.scale;
  });

  return (
    <group ref={group}>
      <mesh material={material}>
        <sphereGeometry args={[SPHERE.radius, 96, 64]} />
      </mesh>

      {glow && (
        <mesh ref={halo} material={haloMaterial}>
          <sphereGeometry args={[SPHERE.radius, 32, 24]} />
        </mesh>
      )}

      {/* Luzes próprias: viajam com a esfera e giram com o scroll. */}
      <pointLight
        ref={keyLight}
        color="#fff6ea"
        intensity={7}
        distance={0}
        decay={0}
      />
      <pointLight
        ref={rimLight}
        color="#3db4ff"
        intensity={4.5}
        distance={0}
        decay={0}
      />

      {/*
        Preenchimento: a face na sombra não pode virar um buraco cinza. Fraca
        e fria, imita o azul que a atmosfera do planeta devolve para cima.
      */}
      <pointLight
        color="#4a80d4"
        intensity={0.8}
        position={[-1.2, -1.6, 2.2]}
        distance={0}
        decay={0}
      />

      {/* O que a esfera devolve ao espaço à sua volta. */}
      {glow && (
        <pointLight color="#8fc8ff" intensity={1.6} distance={4.5} decay={2} />
      )}
    </group>
  );
}
