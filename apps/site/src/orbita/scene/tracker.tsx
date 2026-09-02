"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Vector3 } from "three";
import { allAnchors } from "../lib/store";
import { PLANET_RADIUS } from "../lib/orbit";

/**
 * Costura o HTML na cena.
 *
 * Os textos ficam no DOM (nítidos, selecionáveis, acessíveis) mas obedecem a
 * pontos 3D reais: cada frame projeta a âncora na tela e escreve a transform
 * direto no elemento. Nenhum re-render do React acontece nesse caminho.
 *
 * O teste de oclusão é analítico — se o segmento câmera→âncora atravessa a
 * esfera do planeta, o rótulo desaparece junto com o nó que ele descreve.
 */
/** Tamanhos medidos uma vez por resize — ler offsetWidth a 60fps forçaria reflow. */
const sizeCache = new WeakMap<HTMLElement, { w: number; h: number }>();

export function AnchorTracker() {
  const { camera, size } = useThree();
  const projected = useMemo(() => new Vector3(), []);
  const toPoint = useMemo(() => new Vector3(), []);

  // Invalida as medidas quando o palco muda de tamanho — o registro de âncoras
  // é global e estável, então só as dimensões precisam estar nas deps.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps intencionais
  useMemo(() => {
    for (const anchor of allAnchors().values()) {
      if (anchor.el) sizeCache.delete(anchor.el);
    }
  }, [size.width, size.height]);

  useFrame(() => {
    const anchors = allAnchors();
    if (anchors.size === 0) return;

    const halfW = size.width / 2;
    const halfH = size.height / 2;

    for (const anchor of anchors.values()) {
      const el = anchor.el;
      if (!el) continue;

      projected.copy(anchor.position);
      const distance = projected.distanceTo(camera.position);
      projected.project(camera);

      const behindCamera = projected.z > 1;

      // Oclusão pelo planeta: aproximação do segmento câmera→ponto à origem.
      toPoint.copy(anchor.position).sub(camera.position);
      const len = toPoint.length();
      toPoint.divideScalar(len || 1);
      const t = -camera.position.dot(toPoint);
      let occluded = false;
      if (t > 0 && t < len) {
        const closest = camera.position.distanceTo(
          toPoint.clone().multiplyScalar(t).add(camera.position),
        );
        occluded = closest < PLANET_RADIUS * 1.005;
      }

      let x = projected.x * halfW;
      let y = -projected.y * halfH;
      const offscreen =
        Math.abs(projected.x) > 1.3 || Math.abs(projected.y) > 1.35;

      // Encosta, mas não sai. Um rótulo pela metade fora da tela é pior do que
      // um rótulo alguns pixels fora do seu ponto exato — a linha-guia
      // continua mostrando a qual nó ele pertence.
      let box = sizeCache.get(el);
      if (!box) {
        box = { w: el.offsetWidth, h: el.offsetHeight };
        if (box.w > 0) sizeCache.set(el, box);
      }
      const padX = box.w / 2 + 32;
      // O topo reserva a faixa da navegação; a base, a dica de scroll.
      const padTop = box.h / 2 + 104;
      const padBottom = box.h / 2 + 56;
      if (halfW > padX) x = Math.max(-halfW + padX, Math.min(halfW - padX, x));
      if (halfH > padTop && halfH > padBottom) {
        y = Math.max(-halfH + padTop, Math.min(halfH - padBottom, y));
      }

      // Fora de foco o rótulo não fica só transparente: sai da composição.
      // Um elemento com backdrop-filter e opacity 0 continua borrando o que
      // está atrás dele, e isso desenhava retângulos fantasmas sobre as estrelas.
      const unfocused = anchor.focus < 0.06;

      anchor.depth = distance;
      anchor.hidden = behindCamera || occluded;

      el.style.setProperty("--ax", `${x.toFixed(1)}px`);
      el.style.setProperty("--ay", `${y.toFixed(1)}px`);
      el.style.setProperty("--adepth", distance.toFixed(3));
      el.style.setProperty("--focus", anchor.focus.toFixed(3));
      el.dataset.hidden =
        behindCamera || occluded || offscreen || unfocused ? "true" : "false";
    }
  });

  return null;
}
