"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  BackSide,
  AdditiveBlending,
  type Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import type { QualitySettings } from "../lib/quality";
import { PLANET_RADIUS } from "../lib/orbit";
import { scroll } from "../lib/store";
import { clamp, smoothstep } from "../lib/cn";

/** Direção do sol: fixa, criando o terminador do storyboard (luz vindo do topo-direita). */
export const SUN_DIRECTION = new Vector3(0.62, 0.36, 0.7).normalize();

const surfaceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const surfaceFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D specMap;
  uniform sampler2D bumpMap;
  uniform vec3 sunDir;
  uniform vec3 atmosphere;
  uniform vec2 texel;
  uniform float nightIntensity;
  uniform float useRelief;
  uniform float useSpec;
  uniform float dim;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormalW);

    // Relevo: gradiente da topografia projetado no frame tangente da esfera.
    if (useRelief > 0.5) {
      vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
      vec3 B = cross(N, T);
      float h  = texture2D(bumpMap, vUv).r;
      float hx = texture2D(bumpMap, vUv + vec2(texel.x, 0.0)).r;
      float hy = texture2D(bumpMap, vUv + vec2(0.0, texel.y)).r;
      N = normalize(N + (T * (h - hx) + B * (h - hy)) * 2.4);
    }

    float ndl = dot(N, sunDir);
    float daylight = smoothstep(-0.06, 0.22, ndl);

    vec3 dayCol = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;

    // Luzes das cidades: realçadas e levemente quentes, como no material de referência.
    // Expoente alto de propósito: a textura Black Marble traz muito airglow
    // difuso, e sem essa compressão ele vira uma faixa alaranjada larga sobre
    // metade do planeta. Assim sobram as cidades, que é o que interessa.
    vec3 lights = pow(nightCol, vec3(2.1)) * nightIntensity * vec3(1.0, 0.9, 0.72);

    vec3 lit = dayCol * (0.05 + 1.02 * max(ndl, 0.0));
    vec3 col = mix(lights, lit, daylight);

    // Brilho especular do sol na água.
    if (useSpec > 0.5) {
      float water = texture2D(specMap, vUv).r;
      vec3 H = normalize(sunDir + vViewDir);
      float spec = pow(max(dot(N, H), 0.0), 70.0) * water * daylight;
      col += vec3(1.0, 0.97, 0.9) * spec * 0.6;
    }

    // Espalhamento atmosférico no limbo — o anel azul que envolve o globo.
    float fres = pow(1.0 - max(dot(normalize(vNormalW), vViewDir), 0.0), 3.1);
    col += atmosphere * fres * (0.30 + 0.95 * daylight);

    // Terminador: uma linha quente e estreita, não uma faixa. O valor baixo
    // aqui é deliberado — o storyboard tem um planeta azul-frio, e qualquer
    // excesso de laranja rouba a cena do arco.
    // A janela é estreita de propósito. Perto do limbo o ndl varia devagar ao
    // longo da superfície, então uma faixa larga em ângulo vira um borrão
    // marrom de dezenas de pixels sobre o lado noturno.
    float term = smoothstep(-0.02, 0.025, ndl) * (1.0 - smoothstep(0.025, 0.085, ndl));
    col += vec3(0.72, 0.3, 0.08) * term * 0.055;

    /*
      No modo produto o planeta vira fundo.

      Ele continua atrás da esfera, com o mesmo relevo e as mesmas luzes de
      cidade — só que abaixado, para o branco do produto e o texto ganharem a
      cena. Apagar de vez custaria a profundidade; abaixar mantém o lugar.
    */
    col *= dim;

    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Props = { quality: QualitySettings };

export function Planet({ quality }: Props) {
  const t = quality.textures;
  const paths = useMemo(
    () => [t.day, t.night, t.spec ?? t.day, t.bump ?? t.day],
    [t.day, t.night, t.spec, t.bump],
  );

  const [dayMap, nightMap, specMap, bumpMap] = useLoader(
    TextureLoader,
    paths,
  ) as Texture[];

  const material = useMemo(() => {
    dayMap.colorSpace = SRGBColorSpace;
    nightMap.colorSpace = SRGBColorSpace;
    dayMap.anisotropy = 8;
    nightMap.anisotropy = 8;

    return new ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      uniforms: {
        dayMap: { value: dayMap },
        nightMap: { value: nightMap },
        specMap: { value: specMap },
        bumpMap: { value: bumpMap },
        sunDir: { value: SUN_DIRECTION },
        atmosphere: { value: new Vector3(0.16, 0.42, 0.92) },
        texel: { value: new Vector2(1 / 2048, 1 / 1024) },
        nightIntensity: { value: 1.5 },
        useRelief: { value: t.bump ? 1 : 0 },
        useSpec: { value: t.spec ? 1 : 0 },
        dim: { value: 1 },
      },
    });
  }, [dayMap, nightMap, specMap, bumpMap, t.bump, t.spec]);

  const mesh = useRef<Mesh>(null);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    // Rotação própria, lenta: a Terra continua girando mesmo com o scroll parado.
    mesh.current.rotation.y += dt * 0.012 + scroll.velocity * 0.02;
    material.uniforms.dim.value =
      1 - smoothstep(clamp(scroll.product.t)) * 0.74;
  });

  return (
    <mesh ref={mesh} material={material}>
      <sphereGeometry
        args={[
          PLANET_RADIUS,
          quality.planetSegments,
          quality.planetSegments / 2,
        ]}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */

const cloudsVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const cloudsFragment = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float dim;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    // O mapa marca a nuvem no ESCURO: ~76% do arquivo e quase branco, que e o
    // ceu limpo. Lendo o canal direto, o planeta ficava coberto de nuvem onde
    // deveria estar limpo -- dai o ar de bola de neve. Por isso o 1.0 - c.
    float c = 1.0 - texture2D(cloudMap, vUv).r;
    c = smoothstep(0.16, 0.70, c);
    if (c < 0.01) discard;

    float ndl = dot(normalize(vNormalW), sunDir);
    float daylight = smoothstep(-0.10, 0.34, ndl);

    // A nuvem some no limbo para não criar uma casca visível sobre o planeta.
    float rim = max(dot(normalize(vNormalW), vViewDir), 0.0);
    float edge = smoothstep(0.0, 0.42, rim);

    vec3 col = mix(vec3(0.05, 0.09, 0.16), vec3(1.0), daylight);
    gl_FragColor = vec4(col, c * edge * (0.16 + 0.72 * daylight) * dim);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Clouds({ quality }: Props) {
  const path = quality.textures.clouds;
  const map = useLoader(TextureLoader, path ?? quality.textures.day) as Texture;
  const mesh = useRef<Mesh>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: cloudsVertex,
        fragmentShader: cloudsFragment,
        uniforms: {
          cloudMap: { value: map },
          sunDir: { value: SUN_DIRECTION },
          dim: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
      }),
    [map],
  );

  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt * 0.017;
    material.uniforms.dim.value =
      1 - smoothstep(clamp(scroll.product.t)) * 0.85;
  });

  if (!path) return null;

  return (
    <mesh ref={mesh} material={material}>
      <sphereGeometry args={[PLANET_RADIUS * 1.006, 72, 36]} />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 color;
  uniform vec3 sunDir;
  uniform float strength;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    // Casca renderizada por dentro: o fresnel invertido vira o halo do planeta.
    float fres = pow(1.0 - abs(dot(normalize(vNormalW), vViewDir)), 3.4);
    float ndl = dot(-normalize(vNormalW), sunDir);
    float lit = smoothstep(-0.45, 0.55, ndl);
    gl_FragColor = vec4(color, fres * strength * (0.18 + 0.95 * lit));

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Atmosphere() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          color: { value: new Vector3(0.22, 0.55, 1.0) },
          sunDir: { value: SUN_DIRECTION },
          strength: { value: 1.15 },
        },
        transparent: true,
        blending: AdditiveBlending,
        side: BackSide,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    material.uniforms.strength.value =
      1.15 * (1 - smoothstep(clamp(scroll.product.t)) * 0.7);
  });

  return (
    <mesh material={material} scale={1.055}>
      <sphereGeometry args={[PLANET_RADIUS, 64, 32]} />
    </mesh>
  );
}
