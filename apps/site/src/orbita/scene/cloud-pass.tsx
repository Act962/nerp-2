"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  type Mesh,
  type PerspectiveCamera,
  ShaderMaterial,
  Vector3,
} from "three";
import { clamp } from "../lib/cn";
import { craftCut } from "../lib/craft";
import { craftPhase, riseAmount, whiteAmount } from "../lib/timeline";
import { scroll } from "../lib/store";

/**
 * A camada de nuvem que a câmera atravessa.
 *
 * Antes isto era um `div` branco com opacidade, e parecia o que era: uma tela
 * branca subindo por cima da cena. Nuvem não tem opacidade uniforme — ela tem
 * grumo, borda rasgada e volume, e some primeiro nos buracos.
 *
 * Aqui a nuvem é calculada: ruído fractal com deformação de domínio, num plano
 * preso à frente da câmera. Conforme a densidade sobe, o limiar desce e os
 * buracos fecham — é assim que se entra numa nuvem de verdade, pelos rasgos
 * primeiro. Sem textura nenhuma, então ela aguenta qualquer aproximação.
 *
 * O mesmo passe serve às duas pontas da viagem: fecha na descida antes da nave
 * e fecha na subida antes do espaço. Na subida isso é o que garante o pedido
 * do storyboard — **o preto só aparece depois de passar pela camada de nuvem**,
 * e não antes.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uDensity;
  uniform float uTime;
  uniform float uAspect;
  uniform float uZoom;
  uniform float uCut;
  uniform float uCutSoft;
  uniform float uOctaves;

  varying vec2 vUv;

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

  /*
    As oitavas giram entre si.

    Dobrar a frequência sem girar deixa todas as camadas alinhadas ao mesmo
    eixo do ruído, e o resultado ganha um xadrez que o olho pega na hora —
    principalmente nas partes densas, onde não há forma competindo.
  */
  const mat3 GIRO = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );

  float fbm(vec3 p) {
    float soma = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uOctaves) break;
      soma += amp * noise(p);
      p = GIRO * p * 2.03;
      amp *= 0.5;
    }
    return soma;
  }

  void main() {
    if (uDensity <= 0.0) discard;

    /*
      Entrar na nuvem é atravessá-la, não ampliá-la.

      A primeira versão ampliava o campo dividindo o uv pela densidade, e
      isso comprimia tanto a amostragem que sobravam duas ou três células de
      ruído na tela inteira — o denso virava um xadrez de blocos retos. Agora a
      escala quase não muda; o que anda é a PROFUNDIDADE, e a câmera atravessa
      camadas novas em vez de esticar as mesmas.
    */
    vec2 uv = vUv - 0.5;
    uv.x *= uAspect;
    uv /= (1.0 + uZoom * 0.85);

    vec3 p = vec3(uv * 3.1, uTime * 0.035 + uZoom * 2.6);

    // Deformação de domínio: sem ela o ruído fica com cara de manchas de tinta,
    // e não de vapor sendo empurrado.
    float warp = fbm(p * 0.55);
    float d = fbm(p + warp * 0.85);

    /*
      O limiar desce com a densidade.

      É este trecho que faz a entrada parecer real: no começo só as cristas
      passam do limiar e aparecem fiapos soltos; no fim o limiar está abaixo de
      todo o campo e não sobra buraco. Uma opacidade global faria tudo clarear
      junto, que é exatamente o que não acontece dentro de uma nuvem.
    */
    float limiar = mix(1.02, -0.55, uDensity);
    float a = smoothstep(limiar, limiar + 0.40, d);

    // A asa da nave leva o branco embora: à esquerda do corte não há nuvem.
    a *= smoothstep(uCut - uCutSoft, uCut + uCutSoft * 0.35, vUv.x);

    if (a <= 0.002) discard;

    // Onde é fina, a nuvem é cinza-azulada; onde é densa, branca.
    vec3 col = mix(vec3(0.74, 0.80, 0.88), vec3(1.0), smoothstep(0.28, 0.85, d));

    gl_FragColor = vec4(col, a);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const frente = new Vector3();

type Props = {
  /** Quantas oitavas de ruído. Menos no celular: é custo por pixel. */
  octaves?: number;
  /** Ordem de desenho — a nave passa entre duas camadas destas. */
  renderOrder?: number;
  /** A camada da frente é fina e não recebe o corte: são fiapos passando. */
  foreground?: boolean;
};

export function CloudPass({
  octaves = 5,
  renderOrder = 100,
  foreground = false,
}: Props) {
  const mesh = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uDensity: { value: 0 },
          uTime: { value: 0 },
          uAspect: { value: 1.6 },
          uZoom: { value: 0 },
          uCut: { value: -1 },
          uCutSoft: { value: 0.06 },
          uOctaves: { value: octaves },
        },
      }),
    [octaves],
  );

  useFrame(() => {
    const el = mesh.current;
    if (!el) return;

    const p = scroll.smooth;
    /*
      As duas pontas usam o mesmo passe. Na descida a nuvem fecha antes da
      nave; na subida ela fecha antes do espaço — o preto só chega depois.
    */
    const densidade = Math.max(whiteAmount(p), riseAmount(p));
    const fina = foreground ? 0.55 : 1;
    material.uniforms.uDensity.value = clamp(densidade * fina);

    if (densidade <= 0) {
      el.visible = false;
      return;
    }
    el.visible = true;

    material.uniforms.uTime.value = scroll.time;
    const aspect = size.height > 0 ? size.width / size.height : 1.6;
    material.uniforms.uAspect.value = aspect;
    // A nuvem "abre" enquanto se entra nela: as formas crescem para fora.
    material.uniforms.uZoom.value = densidade;

    /*
      O corte da asa só existe na descida, e só para a camada de trás — é ela
      que esconde o mar. A da frente são fiapos que passam sobre a nave.
    */
    const fase = craftPhase(p);
    material.uniforms.uCut.value =
      foreground || fase <= 0 || riseAmount(p) > 0
        ? -1
        : craftCut(fase, aspect);

    /*
      A distância acompanha o plano de recorte da câmera.

      Sobre o mar o `near` sobe de 0.05 para 0.5 — o mar tem 2400 de lado e
      precisa de profundidade —, e um plano fixo em 0.4 passava a ficar ATRÁS
      do recorte: a nuvem simplesmente sumia justamente no trecho em que ela
      cobre a troca de cena.
    */
    const distancia = camera.near * 2.2;
    camera.getWorldDirection(frente);
    el.position.copy(camera.position).addScaledVector(frente, distancia);
    el.quaternion.copy(camera.quaternion);

    const altura =
      2 * Math.tan(((camera.fov * Math.PI) / 180) * 0.5) * distancia;
    el.scale.set(altura * aspect, altura, 1);
  });

  return (
    <mesh
      ref={mesh}
      material={material}
      renderOrder={renderOrder}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
