"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { type PerspectiveCamera, Vector3 } from "three";
import { PLANET_RADIUS } from "../lib/orbit";
import { scroll } from "../lib/store";

/**
 * Publica onde o planeta está na tela, em pixels.
 *
 * O arco da abertura converge para cá — assim como o círculo branco converge
 * para a esfera 3D. As duas peças da marca são entregues a dois objetos reais
 * da cena, e é isso que faz a transição fechar sozinha em qualquer tela.
 *
 * O raio sai da fórmula exata da silhueta de uma esfera (`asin(r/d)`), não de
 * um ponto deslocado: para um corpo grande e próximo como o planeta, a
 * aproximação erraria uns 3% — o bastante para o anel não encaixar.
 */
export function GlobeProjection() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const center = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const distance = camera.position.length();
    if (distance <= PLANET_RADIUS) return;

    center.set(0, 0, 0).project(camera);
    scroll.globe.x = (center.x * 0.5 + 0.5) * size.width;
    scroll.globe.y = (-center.y * 0.5 + 0.5) * size.height;

    const halfFov = (camera.fov * Math.PI) / 360;
    const angular = Math.asin(PLANET_RADIUS / distance);
    scroll.globe.r =
      (Math.tan(angular) / Math.tan(halfFov)) * (size.height / 2);
    scroll.globe.ready = true;
  });

  return null;
}
