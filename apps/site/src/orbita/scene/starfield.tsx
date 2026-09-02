"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Points,
  ShaderMaterial,
} from "three";
import { scroll } from "../lib/store";

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aTint;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vTint;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Cintilação lenta e dessincronizada — estrelas discretas, sem "pisca-pisca".
    float twinkle = 0.72 + 0.28 * sin(uTime * 0.6 + aPhase * 6.2831);
    vAlpha = twinkle;
    vTint = aTint;
    gl_PointSize = aSize * uScale * twinkle * (300.0 / -mv.z);
  }
`;

const fragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float falloff = smoothstep(0.25, 0.0, d);
    gl_FragColor = vec4(vTint, falloff * falloff * vAlpha);
  }
`;

export function Starfield({ count = 2000 }: { count?: number }) {
  const points = useRef<Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const tints = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribuição uniforme numa casca esférica bem distante.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = 44 + Math.random() * 26;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = Math.cos(theta) * s * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = Math.sin(theta) * s * r;

      const bright = Math.random() ** 3.4;
      sizes[i] = 0.55 + bright * 3.6;
      phases[i] = Math.random();

      // Maioria branco-azulada, algumas levemente quentes.
      const warm = Math.random() > 0.86;
      tints[i * 3] = warm ? 1 : 0.82 + Math.random() * 0.18;
      tints[i * 3 + 1] = warm ? 0.9 : 0.88 + Math.random() * 0.12;
      tints[i * 3 + 2] = warm ? 0.76 : 1;
    }

    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("aSize", new BufferAttribute(sizes, 1));
    g.setAttribute("aPhase", new BufferAttribute(phases, 1));
    g.setAttribute("aTint", new BufferAttribute(tints, 3));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  useFrame(() => {
    material.uniforms.uTime.value = scroll.time;
    if (points.current) {
      // Deriva quase imperceptível: dá vida ao fundo sem competir com a órbita.
      points.current.rotation.y = scroll.time * 0.0035 + scroll.smooth * 0.22;
      points.current.rotation.x = scroll.smooth * 0.08;
    }
  });

  return <points ref={points} geometry={geometry} material={material} />;
}
