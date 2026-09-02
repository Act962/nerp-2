"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Curve,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { orbitAngleAt, orbitPosition } from "../lib/orbit";
import { scroll } from "../lib/store";
import { clamp, smoothstep } from "../lib/cn";

class OrbitCurve extends Curve<Vector3> {
  // O construtor de Curve é `protected` nos tipos do three; redeclará-lo como
  // público aqui é o que permite instanciar a curva da órbita.
  // biome-ignore lint/complexity/noUselessConstructor: necessário para os tipos do three
  constructor() {
    super();
  }

  getPoint(t: number, target = new Vector3()) {
    return orbitPosition(t * Math.PI * 2, target);
  }
}

const pathVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const pathFragment = /* glsl */ `
  uniform float head;
  uniform float intensity;
  uniform vec3 colorCore;
  uniform vec3 colorTrail;
  varying vec2 vUv;

  void main() {
    // Distância angular até o símbolo, respeitando a volta completa.
    float d = abs(vUv.x - head);
    d = min(d, 1.0 - d);

    // O trecho já percorrido permanece aceso; o que vem à frente é só um fio.
    float behind = step(vUv.x, head);
    float trail = exp(-d * 5.0);
    float base = mix(0.16, 0.42, behind);
    float a = (base + trail * 0.85) * intensity;

    // Perfil transversal: o tubo brilha no centro e some nas bordas.
    float cross = 1.0 - abs(vUv.y - 0.5) * 2.0;
    a *= pow(cross, 1.6);

    vec3 col = mix(colorTrail, colorCore, trail);
    gl_FragColor = vec4(col, a);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function OrbitPath({ intensity = 1 }: { intensity?: number }) {
  const geometry = useMemo(
    () => new TubeGeometry(new OrbitCurve(), 480, 0.014, 8, true),
    [],
  );

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: pathVertex,
        fragmentShader: pathFragment,
        uniforms: {
          head: { value: 0 },
          intensity: { value: intensity },
          colorCore: { value: new Vector3(0.55, 0.82, 1.0) },
          colorTrail: { value: new Vector3(0.04, 0.35, 0.85) },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [intensity],
  );

  useFrame(() => {
    material.uniforms.head.value =
      (orbitAngleAt(scroll.smooth) / (Math.PI * 2)) % 1;
    material.uniforms.intensity.value =
      intensity * (1 - smoothstep(clamp(scroll.product.t)));
  });

  return <mesh geometry={geometry} material={material} />;
}
