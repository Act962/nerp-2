"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  type Group,
  Line,
  LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
  Vector3,
} from "three";
import { orbitAngleAt, orbitPosition, toolAngles } from "../lib/orbit";
import { getAnchor, scroll } from "../lib/store";
import { openProduct } from "../lib/product-store";
import { ORBIT_TOOLS } from "../data/catalog";
import { clamp, smoothstep } from "../lib/cn";

/**
 * As ferramentas como esferas na órbita.
 *
 * Cada uma das 19 ferramentas da suíte é um nó real na trajetória, clicável.
 * O nó mais próximo do ângulo atual do scroll fica em foco — cresce, acende e
 * abre o rótulo completo; os vizinhos mostram só o nome; os distantes somem.
 * É assim que 19 pontos cabem numa órbita sem virar poluição.
 *
 * O rótulo é HTML preso ao nó (ver `tracker.tsx`), então continua nítido e
 * selecionável, e desaparece sozinho quando o planeta passa na frente.
 */

/** Raio do alvo invisível de clique — o núcleo visível é pequeno demais para mirar. */
const HIT_RADIUS = 0.085;

export function ToolNodes() {
  const angles = useMemo(() => toolAngles(ORBIT_TOOLS.length), []);
  /*
    No retrato só um rótulo aparece por vez.

    Em 390px de largura quatro placas se empilham e nenhuma fica legível. A
    janela de foco encolhe até caber uma: quem está mais perto do ângulo atual
    do scroll mostra o nome, os vizinhos ficam só como ponto de luz.
  */
  const narrow = useThree((s) => s.size.width < 860);

  const nodes = useMemo(
    () =>
      ORBIT_TOOLS.map((tool, i) => {
        const angle = angles[i];
        const position = orbitPosition(angle, new Vector3());

        // O rótulo é puxado para fora da órbita, pelo lado oposto ao planeta,
        // e alterna acima/abaixo para dois vizinhos nunca se empilharem.
        const label = position
          .clone()
          .add(position.clone().normalize().multiplyScalar(0.62))
          .add(new Vector3(0, i % 2 === 0 ? 0.26 : -0.26, 0));

        return { tool, angle, position, label };
      }),
    [angles],
  );

  useMemo(() => {
    for (const n of nodes)
      getAnchor(`tool-${n.tool.id}`).position.copy(n.label);
  }, [nodes]);

  return (
    <>
      {nodes.map((n) => (
        <ToolNode
          key={n.tool.id}
          id={n.tool.id}
          angle={n.angle}
          position={n.position}
          label={n.label}
          narrow={narrow}
        />
      ))}
    </>
  );
}

function ToolNode({
  id,
  angle,
  position,
  label,
  narrow,
}: {
  id: string;
  angle: number;
  position: Vector3;
  label: Vector3;
  narrow: boolean;
}) {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const state = useRef({ hover: 0, focus: 0 });

  // Fio que liga o nó ao rótulo — o traço do diagrama de estações.
  const leader = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(),
      label.clone().sub(position),
    ]);
    const material = new LineBasicMaterial({
      color: 0x4aa8ff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return new Line(geometry, material);
  }, [label, position]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.12);
    const anchor = getAnchor(`tool-${id}`);

    // Proximidade do ângulo atual: é o que define quem está em foco.
    const distance = Math.abs(orbitAngleAt(scroll.smooth) - angle);
    // A janela estreita do retrato deixa só um rótulo acima do limiar.
    const focus = Math.max(0, 1 - distance / (narrow ? 0.14 : 0.42));

    const hovered = scroll.product.hovered === id ? 1 : 0;
    state.current.hover +=
      (hovered - state.current.hover) * (1 - Math.exp(-14 * dt));
    state.current.focus +=
      (focus - state.current.focus) * (1 - Math.exp(-10 * dt));

    const h = state.current.hover;
    const f = state.current.focus;

    /*
      No modo produto a órbita sai de cena.

      O nó aberto é o único que permanece — ele vira o palco, e a esfera grande
      pousa exatamente sobre ele. Os outros 18 desapareceriam por trás do painel
      de qualquer forma; apagá-los evita pontos de luz soltos atrás do texto.
    */
    const open = scroll.product.id === id;
    const away = smoothstep(clamp(scroll.product.t));
    const presence = open ? 1 : 1 - away;

    // Antes da cortina terminar, a órbita ainda não existe.
    const arrived = smoothstep(clamp((scroll.intro - 0.82) / 0.18));
    const visible = presence * arrived;

    anchor.focus = Math.max(f, h) * visible * (open ? 0 : 1);

    const g = group.current;
    if (g) g.visible = visible > 0.01;

    const pulse = 1 + Math.sin(scroll.time * 2 + angle * 3) * 0.05;
    if (core.current) {
      core.current.scale.setScalar((0.5 + f * 0.6 + h * 0.7) * pulse * visible);
    }
    if (halo.current) {
      halo.current.scale.setScalar((1 + f * 2.2 + h * 2.6) * pulse);
      const m = halo.current.material as MeshBasicMaterial;
      m.opacity = (0.05 + f * 0.26 + h * 0.34) * visible;
    }
    (leader.material as LineBasicMaterial).opacity =
      Math.max(f, h) * 0.5 * visible * (open ? 0 : 1);
  });

  return (
    <group ref={group} position={position}>
      <primitive object={leader} />

      <mesh ref={core}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshBasicMaterial color="#dceeff" />
      </mesh>

      <mesh ref={halo}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshBasicMaterial
          color="#3fa9ff"
          transparent
          opacity={0.16}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/*
        Alvo de clique invisível.

        O núcleo tem 3 centésimos de raio — mirar nele com o mouse seria um
        exercício de pontaria. Esta esfera maior recebe os eventos e não é
        desenhada.
      */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: é uma malha 3D, não um elemento do DOM — o mesmo produto abre pelo botão do rótulo, que é acessível por teclado */}
      <mesh
        visible={false}
        onClick={(event) => {
          event.stopPropagation();
          openProduct(id, angle);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (scroll.product.id) return;
          scroll.product.hovered = id;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (scroll.product.hovered === id) scroll.product.hovered = null;
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[HIT_RADIUS, 12, 8]} />
      </mesh>
    </group>
  );
}
