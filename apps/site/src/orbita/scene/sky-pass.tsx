"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  type Mesh,
  type PerspectiveCamera,
  ShaderMaterial,
  Vector3,
} from "three";
import { clamp, smoothstep } from "../lib/cn";
import { oceanAmount } from "../lib/timeline";
import { scroll } from "../lib/store";

/**
 * O céu do sobrevoo.
 *
 * Antes o que existia acima do horizonte era uma cor chapada, e ela precisava
 * ser pálida para encontrar a névoa do mar sem emenda — o resultado era um
 * horizonte branco, sem céu nenhum. Agora é um degradê de quatro paradas,
 * medido na foto de referência que o cliente enviou: azul profundo no zênite,
 * abrindo para um azul claro na linha do horizonte.
 *
 * A direção do raio sai da própria geometria: o plano cobre exatamente o
 * quadro, então a posição de mundo de cada pixel menos a da câmera dá o raio
 * daquele pixel. Não é uma cúpula — é o quadro inteiro, e custa um passe.
 *
 * Os cúmulos baixos são o que separa "degradê" de "céu". Ficam só na faixa
 * junto ao horizonte, como na foto, e somem para cima.
 */

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uCam;
  uniform vec3 uZenith;
  uniform vec3 uHigh;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform float uAlpha;
  uniform float uTime;

  varying vec3 vWorld;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * noise(p);
      p *= 2.07;
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 dir = normalize(vWorld - uCam);
    float y = clamp(dir.y, 0.0, 1.0);

    // Quatro paradas, medidas na foto: o azul fecha depressa acima do horizonte
    // e depois sobe devagar até o zênite.
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.075, y));
    col = mix(col, uHigh, smoothstep(0.06, 0.30, y));
    col = mix(col, uZenith, smoothstep(0.26, 0.85, y));

    /*
      Cúmulos rasteiros.

      Só na faixa junto ao horizonte, como na referência: acima dela o céu é
      limpo. A projeção divide pela altura do raio — é o que espalha as nuvens ao longe e
      as aproxima do olho, em vez de deixá-las do mesmo tamanho na tela toda.
    */
    float faixa = (1.0 - smoothstep(0.015, 0.14, y)) * smoothstep(0.0, 0.012, y);
    if (faixa > 0.001) {
      vec2 plano = dir.xz / max(y + 0.035, 0.02);
      float n = fbm(vec3(plano * 0.85 + uTime * 0.004, uTime * 0.012));
      // Recorte mais fechado: na referência os cúmulos têm borda, não são véu.
      float nuvem = smoothstep(0.50, 0.66, n) * faixa;
      col = mix(col, vec3(0.99, 0.99, 1.0), nuvem * 0.92);
    }

    /*
      O sol é um adensamento, não um clarão.

      Com expoente 22 ele cobria um terço do quadro de branco pelo lado
      esquerdo — exatamente a claridade demais que a referência não tem. Ela é
      um céu limpo de meio-dia alto, sem sol no enquadramento.
    */
    float s = pow(max(dot(dir, normalize(uSun)), 0.0), 140.0);
    col += vec3(1.0, 0.97, 0.90) * s * 0.30;

    /*
      O céu é OPACO, e some misturando-se ao vazio — não pela transparência.

      Material transparente entra numa fila que o three desenha depois de toda
      a geometria opaca, e renderOrder não atravessa essa separação: como
      transparente, este passe era pintado POR CIMA do mar. Sendo opaco, ele
      volta para a fila certa e o mar o cobre normalmente.
    */
    col = mix(vec3(0.004, 0.016, 0.047), col, uAlpha);
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const frente = new Vector3();

/** As quatro paradas do céu, medidas na foto de referência. */
export const SKY_STOPS = {
  zenith: new Color(0x0141ab),
  high: new Color(0x016fd9),
  mid: new Color(0x06acf6),
  horizon: new Color(0x5ab4ed),
};

export function SkyPass({ sun }: { sun: Vector3 }) {
  const mesh = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uCam: { value: new Vector3() },
          uZenith: { value: SKY_STOPS.zenith.clone() },
          uHigh: { value: SKY_STOPS.high.clone() },
          uMid: { value: SKY_STOPS.mid.clone() },
          uHorizon: { value: SKY_STOPS.horizon.clone() },
          uSun: { value: sun.clone() },
          uAlpha: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [sun],
  );

  useFrame(() => {
    const el = mesh.current;
    if (!el) return;

    // O céu só existe onde existe mar: no espaço o fundo continua o vazio.
    const t = smoothstep(clamp(oceanAmount(scroll.smooth)));
    material.uniforms.uAlpha.value = t;
    if (t <= 0.001) {
      el.visible = false;
      return;
    }
    el.visible = true;

    material.uniforms.uTime.value = scroll.time;
    material.uniforms.uCam.value.copy(camera.position);

    const distancia = camera.near * 2.4;
    camera.getWorldDirection(frente);
    el.position.copy(camera.position).addScaledVector(frente, distancia);
    el.quaternion.copy(camera.quaternion);

    const altura =
      2 * Math.tan(((camera.fov * Math.PI) / 180) * 0.5) * distancia;
    const aspect = size.height > 0 ? size.width / size.height : 1.6;
    el.scale.set(altura * aspect, altura, 1);
  });

  return (
    <mesh
      ref={mesh}
      material={material}
      renderOrder={-100}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
