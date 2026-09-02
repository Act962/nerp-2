"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type PerspectiveCamera, Vector3 } from "three";
import { sampleCamera } from "../lib/keyframes";
import { scroll } from "../lib/store";
import { orbitPosition, PLANET_RADIUS } from "../lib/orbit";
import { clamp, damp, smoothstep } from "../lib/cn";
import { oceanAmount, oceanPhase } from "../lib/timeline";
import { OCEAN_FAR, OCEAN_NEAR, sampleOceanCamera } from "../lib/ocean-camera";

/**
 * Enquadramento do modo produto.
 *
 * A câmera sai para fora da órbita, na direção radial do nó aberto, e olha
 * para um ponto à direita dele — é isso que joga a esfera para a esquerda do
 * quadro e deixa a metade direita livre para a roleta. O planeta fica
 * naturalmente atrás, porque o nó está entre ele e a câmera.
 */
const PRODUCT_VIEW = {
  /** Distância da câmera até o nó. */
  distance: 3.2,
  /** Deslocamento do alvo para a direita: empurra a esfera para a esquerda. */
  shift: 0.74,
  /** Só no retrato: quanto o alvo desce, levantando a esfera no quadro. */
  raise: 0.62,
  lift: 0.06,
  fov: 32,
};

/**
 * A câmera é parte da narrativa, não um observador parado.
 *
 * Ela persegue o estado amostrado da timeline com damping — nunca salta — e
 * recebe um empurrão sutil do ponteiro, que existe só como refinamento: o
 * scroll sozinho conta a história inteira.
 */
export function CameraRig({
  compact,
  frozen = false,
}: {
  compact: boolean;
  frozen?: boolean;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const current = useRef(new Vector3(0.75, 0.35, 4.6));
  const lookAt = useRef(new Vector3(-0.29, 0.05, 0));
  const sway = useRef({ x: 0, y: 0 });
  const node = useRef(new Vector3());
  const radial = useRef(new Vector3());
  const side = useRef(new Vector3());
  const productPos = useRef(new Vector3());
  const productTarget = useRef(new Vector3());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.12);
    const s = sampleCamera(frozen ? 0 : scroll.smooth);

    /*
      Enquadramento por proporção de tela.

      A coreografia é a mesma em qualquer aparelho — o que muda é a distância.
      Num retrato 9:19 o campo horizontal é estreito, e a mesma posição de
      câmera que funciona no desktop joga o símbolo para fora do quadro. Em vez
      de "reduzir tudo", a câmera recua o suficiente para que planeta e objeto
      caibam juntos, preservando a composição.
    */
    const aspect = size.height > 0 ? size.width / size.height : 1.6;
    const fitByAspect = Math.max(1, Math.sqrt(1.85 / Math.max(aspect, 0.3)));
    /*
      O ajuste por proporção vale para enquadrar, não para descer.

      Cada estado diz o quanto obedece a ele (`fit`). De longe, obedece
      inteiro — é o que faz o conjunto caber num retrato. Colado na
      superfície, não obedece nada: ali a distância é o assunto, e recuar
      2× deixaria a câmera longe demais para a nuvem tomar a tela.
    */
    const fit = 1 + (fitByAspect - 1) * s.fit;

    /*
      Abertura: a câmera chega de longe.

      Enquanto a cortina azul sobe, o planeta cresce por baixo dela — não
      porque ele mude de tamanho, mas porque a câmera está fechando a distância
      até o enquadramento do hero. No fim da cortina os dois estados coincidem.
    */
    const approach = 1 - smoothstep(scroll.intro);
    const distance = fit * (1 + approach * 0.42);
    const lift = compact ? 0.12 : 0;

    /*
      No retrato a câmera olha para o eixo da órbita.

      O desvio lateral que no desktop abre o terço esquerdo para o texto não
      tem função aqui: no celular o texto fica embaixo, não ao lado. Guardar
      parte dele só empurrava o planeta para a direita, até encostar na borda.
    */
    const centering = compact ? 0 : 1;
    const targetX = s.position.x * distance;
    const targetY = s.position.y * distance + lift + approach * 0.55;
    const targetZ = s.position.z * distance;

    const swayAmount =
      (frozen ? 0 : s.sway) * (1 - smoothstep(clamp(scroll.product.t)) * 0.75);
    sway.current.x = damp(
      sway.current.x,
      scroll.pointerX * 0.16 * swayAmount,
      2.4,
      dt,
    );
    sway.current.y = damp(
      sway.current.y,
      -scroll.pointerY * 0.1 * swayAmount,
      2.4,
      dt,
    );

    /*
      Mistura com o modo produto.

      Os dois enquadramentos são calculados e interpolados por `product.t`.
      Fazer assim — em vez de trocar de modo — é o que permite abrir e fechar
      o produto com um movimento contínuo, e trocar de produto sem passar pela
      órbita no meio do caminho.
    */
    const openT = smoothstep(clamp(scroll.product.t));
    /*
      O sobrevoo tem câmera própria, em escala própria.

      Ela não é mais um estado da tabela do espaço: o mar tem 2400 de lado e a
      câmera desce a 11 de altura, enquanto os estados de lá vivem a 4 unidades
      de um planeta de raio 1. Por isso é uma segunda tabela, misturada por
      `seaT` nas bordas da janela — o mesmo recurso que o modo produto usa.
    */
    const seaT = smoothstep(clamp(oceanAmount(scroll.smooth)));
    let finalX = targetX + sway.current.x;
    let finalY = targetY + sway.current.y;
    let finalZ = targetZ;
    let lookX = s.target.x * centering;
    let lookY = s.target.y + approach * 0.62;
    /*
      O alvo em Z também zera no retrato.

      Zerar só o X não bastava: com a câmera deslocada lateralmente, um alvo
      com profundidade própria ainda deixava o planeta fora do eixo — e no
      herói, onde ele é maior, a diferença virava um corte na borda.
    */
    let lookZ = s.target.z * centering;

    if (openT > 0.001) {
      orbitPosition(scroll.product.angle, node.current);
      radial.current.copy(node.current).normalize();
      // "Direita" do quadro: perpendicular ao raio e à vertical do mundo.
      side.current.set(0, 1, 0).cross(radial.current).normalize();

      const distance = PRODUCT_VIEW.distance * (compact ? 1.42 : 1);
      /*
        No retrato o painel fica embaixo, não ao lado.

        Empurrar a esfera para a esquerda ali só a jogaria para fora da tela:
        o que ela precisa é subir. Por isso o desvio lateral zera e o alvo
        desce — mirar abaixo do nó levanta a esfera no quadro.
      */
      const shift = compact ? 0 : PRODUCT_VIEW.shift;
      const raise = compact ? PRODUCT_VIEW.raise : 0;

      productPos.current
        .copy(node.current)
        .addScaledVector(radial.current, distance)
        .addScaledVector(side.current, shift * 0.4);
      productPos.current.y += PRODUCT_VIEW.lift * distance;

      productTarget.current
        .copy(node.current)
        .addScaledVector(side.current, shift);
      productTarget.current.y -= raise;

      finalX += (productPos.current.x - finalX) * openT;
      finalY += (productPos.current.y - finalY) * openT;
      finalZ += (productPos.current.z - finalZ) * openT;
      lookX += (productTarget.current.x - lookX) * openT;
      lookY += (productTarget.current.y - lookY) * openT;
      lookZ += (productTarget.current.z - lookZ) * openT;
    }

    if (seaT > 0.001) {
      const sea = sampleOceanCamera(oceanPhase(scroll.smooth));
      finalX += (sea.position.x - finalX) * seaT;
      finalY += (sea.position.y - finalY) * seaT;
      finalZ += (sea.position.z - finalZ) * seaT;
      lookX += (sea.target.x - lookX) * seaT;
      lookY += (sea.target.y - lookY) * seaT;
      lookZ += (sea.target.z - lookZ) * seaT;
    }

    /*
      O plano de recorte segue a escala em cena.

      Com `far` em 140 o mar terminaria numa borda reta bem antes da névoa; com
      2600 o espaço perderia precisão de profundidade à toa. Trocar junto com a
      câmera é o que deixa as duas escalas conviverem.
    */
    const far = 140 + (OCEAN_FAR - 140) * seaT;
    const near = 0.05 + (OCEAN_NEAR - 0.05) * seaT;
    if (
      Math.abs(camera.far - far) > 0.5 ||
      Math.abs(camera.near - near) > 0.01
    ) {
      camera.far = far;
      camera.near = near;
      camera.updateProjectionMatrix();
    }

    current.current.x = damp(current.current.x, finalX, 4.5, dt);
    current.current.y = damp(current.current.y, finalY, 4.5, dt);
    current.current.z = damp(current.current.z, finalZ, 4.5, dt);
    camera.position.copy(current.current);

    lookAt.current.x = damp(lookAt.current.x, lookX, 4, dt);
    lookAt.current.y = damp(lookAt.current.y, lookY, 4, dt);
    lookAt.current.z = damp(lookAt.current.z, lookZ, 4, dt);
    camera.lookAt(lookAt.current);

    // Roll leve nos momentos de virada — a "pequena rotação de câmera" do
    // briefing, forte o bastante para sentir e discreta o bastante para não enjoar.
    // Sobre o mar não há roll: o horizonte torto denuncia na hora.
    camera.rotation.z += s.roll * (1 - openT) * (1 - seaT);

    const baseFov = compact ? s.fov * 1.18 : s.fov;
    let targetFov = baseFov + (PRODUCT_VIEW.fov - baseFov) * openT;
    if (seaT > 0.001) {
      const sea = sampleOceanCamera(oceanPhase(scroll.smooth));
      const seaFov = compact ? sea.fov * 1.18 : sea.fov;
      targetFov += (seaFov - targetFov) * seaT;
    }
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = damp(camera.fov, targetFov, 4, dt);
      camera.updateProjectionMatrix();
    }

    /*
      No retrato o globo sobe meio diâmetro.

      A subida é uma descentralização de lente (`setViewOffset`), não uma
      inclinação da câmera: mirar mais para baixo giraria a cena inteira e
      mudaria o ângulo de visão do planeta. Deslocar o frustum move a
      composição no quadro e deixa a coreografia intacta — é o que uma lente
      tilt-shift faz.

      O deslocamento é o raio do planeta projetado em pixels: com ele, a base
      do globo pousa exatamente na metade da tela e a metade de baixo fica
      livre para o texto.
    */
    // O deslocamento de frustum também se desfaz na descida: com o planeta
    // tomando a tela, subir a composição só corta o que interessa.
    const shiftUp = compact ? (1 - openT) * (1 - seaT) * s.fit : 0;
    if (shiftUp > 0.001 && size.height > 0) {
      const halfHeight =
        Math.tan((camera.fov * Math.PI) / 360) * camera.position.length();
      const radiusPx = (PLANET_RADIUS / halfHeight) * (size.height / 2);
      camera.setViewOffset(
        size.width,
        size.height,
        0,
        radiusPx * shiftUp,
        size.width,
        size.height,
      );
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
  });

  return null;
}
