"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  DoubleSide,
  type Mesh,
  MeshBasicMaterial,
  type PerspectiveCamera,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
} from "three";
import { asset } from "../lib/assets";
import { CRAFT_RATIO, CRAFT_SPAN, craftOffset, craftScale } from "../lib/craft";
import { craftPhase, CRAFT } from "../lib/timeline";
import { scroll } from "../lib/store";

/**
 * A nave que atravessa a nuvem.
 *
 * Continua sendo a imagem que o cliente enviou — não virou modelo 3D. O que
 * mudou é onde ela é desenhada: saiu do DOM e entrou na cena, para a camada
 * fina de nuvem poder passar NA FRENTE dela. No DOM isso era impossível: o
 * canvas inteiro fica atrás, e a nave apareceria sempre por cima de tudo, como
 * um adesivo, em vez de surgir entre as nuvens.
 *
 * O plano é preso à frente da câmera e girado 90°: a imagem vem de nariz para
 * cima, e o quadro pede nariz à direita, com as asas passando das bordas.
 */

const frente = new Vector3();
const direita = new Vector3();
const cima = new Vector3();

export function CraftPass({ renderOrder = 101 }: { renderOrder?: number }) {
  const textura = useLoader(
    TextureLoader,
    asset("/orbita/nave.webp"),
  ) as Texture;

  const mesh = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const material = useMemo(() => {
    textura.colorSpace = SRGBColorSpace;
    textura.anisotropy = 8;
    return new MeshBasicMaterial({
      map: textura,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
  }, [textura]);

  useFrame(() => {
    const el = mesh.current;
    if (!el) return;

    const p = scroll.smooth;
    if (p <= CRAFT.from || p >= CRAFT.to) {
      el.visible = false;
      return;
    }
    el.visible = true;

    const fase = craftPhase(p);
    const escala = craftScale(fase);

    // Colada ao plano de recorte, que muda de escala junto com a cena.
    const distancia = camera.near * 2.2;
    camera.getWorldDirection(frente);
    const alturaQuadro =
      2 * Math.tan(((camera.fov * Math.PI) / 180) * 0.5) * distancia;
    const aspect = size.height > 0 ? size.width / size.height : 1.6;
    const larguraQuadro = alturaQuadro * aspect;

    el.quaternion.copy(camera.quaternion);
    // Deitada: o X local passa a ser o vertical do quadro, e é nele que mora a
    // envergadura — que é o que precisa passar das bordas.
    el.rotateZ(-Math.PI / 2);

    const envergadura = CRAFT_SPAN * alturaQuadro * escala;
    el.scale.set(envergadura, envergadura * CRAFT_RATIO, 1);

    direita.set(1, 0, 0).applyQuaternion(camera.quaternion);
    cima.set(0, 1, 0).applyQuaternion(camera.quaternion);

    el.position
      .copy(camera.position)
      .addScaledVector(frente, distancia)
      .addScaledVector(direita, craftOffset(fase) * larguraQuadro)
      .addScaledVector(cima, (0.5 - fase) * 0.05 * alturaQuadro);
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
