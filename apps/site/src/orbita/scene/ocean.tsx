"use client";

/**
 * O mar do tempo "Nossos Parceiros".
 *
 * NÃO ESTÁ MONTADO AINDA. Este arquivo entrou pronto e testado para que a
 * sequência do storyboard (`specs/site-nossos-parceiros.md`) não precise
 * inventar um oceano do zero — falta só pendurá-lo na linha do tempo.
 *
 * Por que uma cena própria, e não o planeta visto de perto: as texturas do
 * planeta são 2k/4k e, a essa distância, o pixel aparece. Aqui não existe
 * textura de água nenhuma — a onda grande é calculada (Gerstner somado no
 * vertex) e o detalhe fino vem de um mapa de normais que se repete. Por isso
 * aguenta a câmera chegar perto.
 *
 * O único arquivo que ele carrega é `/orbita/textures/water-normal.png`
 * (512², ruído fractal gerado para o projeto — sem origem de terceiro).
 */

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  DoubleSide,
  type Mesh,
  NoColorSpace,
  RepeatWrapping,
  ShaderMaterial,
  type Texture,
  TextureLoader,
  Vector3,
} from "three";
import { Color } from "three";
import { asset } from "../lib/assets";
import { scroll } from "../lib/store";

/** Direção do sol no mar. Fica contra a câmera para o rastro aparecer. */
export const OCEAN_SUN = new Vector3(-120, 52, -170);

/*
  O céu que a ÁGUA reflete, em duas paradas.

  Não confundir com o céu que se vê (`scene/sky-pass.tsx`, quatro paradas
  medidas na foto): estes dois só alimentam o reflexo e a névoa do horizonte
  dentro deste shader. Eram quase brancos, e é daí que vinha o horizonte
  lavado — água reflete céu, e céu branco devolve mar branco. Agora saem da
  mesma foto de referência.
*/
export const OCEAN_SKY_LOW = new Color(0x7fc2ea);
export const OCEAN_SKY_HIGH = new Color(0x0a55b4);

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying float vCrest;

  /**
   * Uma onda de Gerstner: desloca o vértice em círculo, não só para cima.
   * É o que dá a crista afiada e o vale largo do mar de verdade.
   */
  vec3 gerstner(vec2 p, vec2 dir, float amp, float len, float speed, float t,
                inout vec3 tang, inout vec3 bin) {
    float k = 6.28318 / len;
    vec2 d = normalize(dir);
    float f = k * (dot(d, p) - speed * t);
    float s = sin(f), c = cos(f);
    tang += vec3(-d.x * d.x * amp * k * s, d.x * amp * k * c, -d.x * d.y * amp * k * s);
    bin  += vec3(-d.x * d.y * amp * k * s, d.y * amp * k * c, -d.y * d.y * amp * k * s);
    return vec3(d.x * amp * c, amp * s, d.y * amp * c);
  }

  void main() {
    vec2 p = position.xy;
    vec3 tang = vec3(1.0, 0.0, 0.0);
    vec3 bin = vec3(0.0, 0.0, 1.0);
    vec3 off = vec3(0.0);

    // Seis direções propositalmente desalinhadas: alinhadas, o mar vira
    // veludo cotelê e o olho pega o padrão na hora.
    off += gerstner(p, vec2( 1.00,  0.16), 1.30, 47.0, 3.9, uTime, tang, bin);
    off += gerstner(p, vec2( 0.72, -0.69), 0.78, 29.0, 3.1, uTime, tang, bin);
    off += gerstner(p, vec2(-0.11,  0.99), 0.46, 17.5, 2.4, uTime, tang, bin);
    off += gerstner(p, vec2( 0.94,  0.34), 0.26,  9.7, 1.9, uTime, tang, bin);
    off += gerstner(p, vec2(-0.83, -0.56), 0.14,  5.3, 1.5, uTime, tang, bin);
    off += gerstner(p, vec2( 0.31,  0.95), 0.08,  2.9, 1.2, uTime, tang, bin);

    vec3 world = vec3(position.x + off.x, off.y, position.y + off.z);
    vTangent = normalize(tang);
    vBitangent = normalize(bin);
    vNormalW = normalize(cross(bin, tang));
    vCrest = smoothstep(1.95, 3.10, off.y);
    vWorld = world;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uNormal;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSkyLow;
  uniform vec3 uSkyHigh;
  uniform vec3 uSun;
  uniform vec3 uCam;
  uniform float uFog;
  uniform float uTime;

  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying float vCrest;

  /** O céu como gradiente, com o sol dentro — é o que a água reflete. */
  vec3 sky(vec3 dir) {
    float k = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(uSkyLow, uSkyHigh, pow(k, 0.9));
    float s = pow(max(dot(normalize(dir), normalize(uSun)), 0.0), 380.0);
    // Era 5.0: o disco do sol no reflexo estourava o branco no meio do mar.
    return c + vec3(1.0, 0.93, 0.80) * s * 2.6;
  }

  vec3 ripple(vec2 uv) {
    return texture2D(uNormal, uv).xyz * 2.0 - 1.0;
  }

  void main() {
    vec3 base = normalize(vNormalW);
    vec3 view = normalize(uCam - vWorld);
    float dist = length(uCam - vWorld);

    // Três escalas de ondulação fina, cada uma correndo para um lado.
    vec2 p = vWorld.xz;
    vec3 d1 = ripple(p * 0.055 + vec2( 0.021,  0.013) * uTime);
    vec3 d2 = ripple(p * 0.140 + vec2(-0.034,  0.026) * uTime);
    vec3 d3 = ripple(p * 0.380 + vec2( 0.048, -0.041) * uTime);

    // Longe, o detalhe fino se desliga. Sem isso a água cintila em movimento,
    // que é o defeito mais visível de um mar em tempo real.
    float lod = 1.0 - smoothstep(90.0, 620.0, dist);
    vec3 det = normalize(d1 * 0.55 + d2 * 0.32 * lod + d3 * 0.20 * lod * lod);

    vec3 n = normalize(
      base + (normalize(vTangent) * det.x + normalize(vBitangent) * det.y)
             * (0.55 + 0.45 * lod)
    );

    float ndv = max(dot(n, view), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

    vec3 reflection = sky(reflect(-view, n));

    vec3 inside = mix(uDeep, uShallow, pow(clamp(n.y, 0.0, 1.0), 2.2));
    float sss = pow(max(dot(view, -normalize(uSun)), 0.0), 3.0)
              * smoothstep(0.0, 1.0, vCrest + 0.2);
    inside += vec3(0.03, 0.16, 0.13) * sss;

    vec3 col = mix(inside, reflection, clamp(fresnel, 0.0, 0.98));

    // GGX: o rastro do sol na água. A rugosidade cresce com a distância,
    // que é o mesmo antialiasing do detalhe fino, só que no brilho.
    vec3 h = normalize(normalize(uSun) + view);
    float rough = mix(0.055, 0.20, smoothstep(60.0, 700.0, dist));
    float a = rough * rough;
    float ndh = max(dot(n, h), 0.0);
    float den = ndh * ndh * (a * a - 1.0) + 1.0;
    // Rastro do sol: era 0.28 com teto 2.2, e cobria metade da água de branco.
    col += vec3(1.0, 0.96, 0.88) * min((a * a) / (3.14159 * den * den) * 0.15, 1.0);

    // Espuma só onde a crista quebra, e recortada pela ondulação fina.
    float breaking = smoothstep(0.20, 0.80, det.z * 0.5 + 0.5);
    float foam = vCrest * breaking * breaking * (0.35 + 0.65 * lod);
    // Espuma: era 0.40 com teto 0.50. Na referência a crista branqueia pouco.
    col = mix(col, vec3(0.93, 0.96, 0.98), clamp(foam * 0.26, 0.0, 0.32));

    // A névoa do horizonte usa a cor do céu daquela direção, não uma cor fixa.
    float fog = 1.0 - exp(-pow(dist / uFog, 2.0));
    col = mix(col, sky(normalize(vec3(-view.x, 0.04, -view.z))), clamp(fog, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Props = {
  /** Fora da janela da seção, o mar não entra em cena nem gasta quadro. */
  visible: boolean;
  /**
   * Densidade da malha. 900 é o que os quadros de referência usaram; no
   * celular vale cair para 420 — a onda grande continua, some só o recorte
   * fino da crista.
   */
  segments?: number;
  /** Distância em que tudo vira névoa. Alto olhando de cima, baixo no rasante. */
  fog?: number;
};

export function Ocean({ visible, segments = 900, fog = 900 }: Props) {
  const normalMap = useLoader(
    TextureLoader,
    asset("/orbita/textures/water-normal.png"),
  ) as Texture;

  const mesh = useRef<Mesh>(null);

  const material = useMemo(() => {
    normalMap.wrapS = RepeatWrapping;
    normalMap.wrapT = RepeatWrapping;
    normalMap.colorSpace = NoColorSpace;
    normalMap.anisotropy = 16;

    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 14 },
        uNormal: { value: normalMap },
        // Azul-marinho no vale, azul aberto na crista, como na foto — antes
        // era quase preto embaixo, o que empurrava todo o contraste para o
        // reflexo e deixava a água parecendo metal.
        uDeep: { value: new Color(0x04173f) },
        uShallow: { value: new Color(0x1f6fb8) },
        uSkyLow: { value: OCEAN_SKY_LOW.clone() },
        uSkyHigh: { value: OCEAN_SKY_HIGH.clone() },
        uSun: { value: OCEAN_SUN.clone() },
        uCam: { value: new Vector3() },
        uFog: { value: fog },
      },
    });
  }, [normalMap, fog]);

  useFrame(({ camera }) => {
    if (!visible) return;
    const u = material.uniforms;
    // O mar anda sozinho no tempo, não no scroll: parado, ele continua vivo.
    u.uTime.value = 14 + scroll.time * 0.9;
    u.uCam.value.copy(camera.position);
    u.uFog.value = fog;
  });

  return (
    <mesh
      ref={mesh}
      visible={visible}
      material={material}
      frustumCulled={false}
    >
      <planeGeometry args={[2400, 2400, segments, segments]} />
    </mesh>
  );
}
