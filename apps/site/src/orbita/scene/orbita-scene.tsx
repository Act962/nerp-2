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
 * O que só existe com um produto aberto.
 *
 * Fica fora do `AfterCurtain` de propósito: o modo produto pode ser aberto em
 * qualquer ponto da viagem, inclusive num trecho em que a órbita está recuada.
 */
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
      onCreated={({ gl, scene }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        scene.background = null;
        onReady?.();
      }}
    >
      <color attach="background" args={["#01040c"]} />

      <SceneEnvironment />
      <Lights />
      <CameraRig compact={compact} />

      <Suspense fallback={null}>
        <Planet quality={quality} />
        {quality.clouds && <Clouds quality={quality} />}
      </Suspense>

      <Atmosphere />
      <Starfield count={quality.stars} />

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

      <GlobeProjection />
      <AnchorTracker />
    </Canvas>
  );
}
