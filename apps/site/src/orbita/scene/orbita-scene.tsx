"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, type Group, Vector3 } from "three";
import { scroll } from "../lib/store";
import type { QualitySettings } from "../lib/quality";
import { Planet, Clouds, Atmosphere, SUN_DIRECTION } from "./planet";
import { OrbitObject } from "./orbit-object";
import { OrbitPath } from "./orbit-path";
import { ToolNodes } from "./tool-nodes";
import { DeviceMockup } from "./device-mockup";
import { useActiveProduct } from "../lib/product-store";
import { Starfield } from "./starfield";
import { CameraRig } from "./camera-rig";
import { AnchorTracker } from "./tracker";
import { GlobeProjection } from "./globe-projection";
import { createProceduralEnvironment } from "./environment";
import { Ocean, OCEAN_SUN } from "./ocean";
import { SkyPass } from "./sky-pass";
import { CRAFT, OCEAN, oceanAmount, orbitVisible } from "../lib/timeline";
import { CloudPass } from "./cloud-pass";
import { CraftPass } from "./craft-pass";

/** Instala o ambiente procedural usado pelos reflexos do símbolo. */
function SceneEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const env = createProceduralEnvironment(gl);
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Lights() {
  const sunPosition = useMemo(
    () => new Vector3().copy(SUN_DIRECTION).multiplyScalar(12),
    [],
  );
  return (
    <>
      <ambientLight intensity={0.22} color="#7ea6d8" />
      <directionalLight
        position={sunPosition}
        intensity={3.1}
        color="#fff6ea"
      />
      {/* Contraluz azul: separa o arco do preto do espaço. */}
      <directionalLight
        position={[-6, -2, -5]}
        intensity={0.9}
        color="#2b6fd6"
      />
    </>
  );
}

/**
 * Segura a órbita fora de cena enquanto a cortina azul desce.
 *
 * Nos quadros de referência, o que existe atrás do azul é só o planeta. A
 * trajetória, as estações e os painéis entram junto com o hero.
 */
function AfterCurtain({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = scroll.intro > 0.82;
  });
  return <group ref={group}>{children}</group>;
}

/**
 * O espaço sai de cena enquanto se voa sobre o mar.
 *
 * O plano do mar tem 2400 de lado e passa pela origem — que é exatamente onde
 * o planeta está. Sem esconder um, o outro apareceria como uma bola encalhada
 * no meio da água. São dois lugares, não duas camadas do mesmo lugar.
 */
function SpaceStage({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = oceanAmount(scroll.smooth) <= 0;
  });
  return <group ref={group}>{children}</group>;
}

/**
 * O mar entra e sai da cena, não só da vista.
 *
 * Montar a malha é caro — 900² segmentos — e ela não tem por que existir
 * enquanto se olha o espaço. Este componente troca de estado uma vez em cada
 * borda da janela, e não a cada quadro: é o único lugar da cena em que o
 * progresso do scroll vira estado do React, e é discreto de propósito.
 */
function OceanStage({ segments }: { segments: number }) {
  const [live, setLive] = useState(false);

  useFrame(() => {
    const p = scroll.smooth;
    const dentro =
      p > OCEAN.from - OCEAN.blendIn * 2 && p < OCEAN.to + OCEAN.blendOut * 4;
    setLive((atual) => (atual === dentro ? atual : dentro));
  });

  if (!live) return null;

  return (
    <Suspense fallback={null}>
      <OceanVisibility>
        <Ocean visible segments={segments} />
      </OceanVisibility>
    </Suspense>
  );
}

/*
  Montado não é o mesmo que em cena.

  A malha é montada com folga, para a geometria estar pronta quando o branco
  abrir. Mas ela só pode APARECER quando o espaço já saiu — os dois ocupam a
  origem, e um quadro com os dois mostra o planeta boiando no mar. O corte é o
  mesmo dos dois lados (`oceanAmount`), então não existe instante em que ambos
  estejam visíveis.
*/
function OceanVisibility({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = oceanAmount(scroll.smooth) > 0;
  });
  return <group ref={group}>{children}</group>;
}

/**
 * A travessia, em três camadas que se intercalam.
 *
 * Nuvem atrás, nave, nuvem à frente. É essa ordem que faz a nave SURGIR ENTRE
 * as nuvens em vez de aparecer colada por cima delas — e é por isso que ela
 * precisou sair do DOM e entrar na cena.
 *
 * A imagem só é montada perto da janela: no carregamento da home ela não é
 * baixada.
 */
function CrossingStage({ octaves }: { octaves: number }) {
  const [naveViva, setNaveViva] = useState(false);

  useFrame(() => {
    const p = scroll.smooth;
    const perto = p > CRAFT.from - 0.06 && p < CRAFT.to + 0.06;
    setNaveViva((atual) => (atual === perto ? atual : perto));
  });

  return (
    <>
      <CloudPass octaves={octaves} renderOrder={100} />
      {naveViva && (
        <Suspense fallback={null}>
          <CraftPass renderOrder={101} />
        </Suspense>
      )}
      <CloudPass
        octaves={Math.max(3, octaves - 1)}
        renderOrder={102}
        foreground
      />
    </>
  );
}

/**
 * O que só existe com um produto aberto.
 *
 * Fica fora do `AfterCurtain` de propósito: o modo produto pode ser aberto em
 * qualquer ponto da viagem, inclusive num trecho em que a órbita está recuada.
 */
/**
 * A órbita — trajetória, estações e esfera — só existe na parte alta da viagem.
 *
 * Ela é o mapa da suíte, e o mapa acaba quando a descida começa. Mantê-la
 * acesa faria a câmera atravessar o próprio anel a caminho da nuvem.
 */
function OrbitStage({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = orbitVisible(scroll.smooth);
  });
  return <group ref={group}>{children}</group>;
}

function ProductStage() {
  const product = useActiveProduct();
  if (!product) return null;
  return <DeviceMockup key={product.id} features={product.features} />;
}

type Props = {
  quality: QualitySettings;
  compact: boolean;
  onReady?: () => void;
};

export function OrbitaScene({ quality, compact, onReady }: Props) {
  // Fora da aba, a experiência congela: nenhum frame é desenhado à toa.
  const [active, setActive] = useState(true);

  useEffect(() => {
    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={quality.dpr}
      gl={{
        antialias: quality.tier !== "low",
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0.75, 0.35, 4.6], fov: 34, near: 0.05, far: 140 }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        // O fundo é de `SkyBackground`: ele vai do vazio ao céu do sobrevoo.
        onReady?.();
      }}
    >
      <color attach="background" args={["#01040c"]} />

      <SceneEnvironment />
      <Lights />
      <CameraRig compact={compact} />

      {/* O céu do sobrevoo entra por trás de tudo, e só onde há mar. */}
      <SkyPass sun={OCEAN_SUN} />

      <SpaceStage>
        <Suspense fallback={null}>
          <Planet quality={quality} />
          {quality.clouds && <Clouds quality={quality} />}
        </Suspense>

        <Atmosphere />
        <Starfield count={quality.stars} />

        <OrbitStage>
          <AfterCurtain>
            <OrbitPath intensity={quality.glow ? 1 : 0.7} />
            <ToolNodes />
          </AfterCurtain>

          <ProductStage />
          <OrbitObject
            scale={compact ? 0.26 : 0.3}
            glow={quality.glow}
            compact={compact}
          />
        </OrbitStage>

        <GlobeProjection />
      </SpaceStage>

      <OceanStage segments={quality.oceanSegments} />

      <CrossingStage octaves={quality.tier === "low" ? 3 : 5} />

      <AnchorTracker />
    </Canvas>
  );
}
