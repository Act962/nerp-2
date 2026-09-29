/**
 * Um evento que não é clique — "o aviso de saída apareceu" — entregue ao
 * medidor por um evento de janela. Quem dispara não precisa saber do medidor,
 * e sem medidor (visitante com `?nao-medir=1`) ele simplesmente não é ouvido.
 */
export const EVENTO_DE_METRICA = "orbita:metrica";

export type DetalheDeMetrica = { rotulo: string; destino?: string };

export function registrarMetrica(rotulo: string, destino?: string) {
  window.dispatchEvent(
    new CustomEvent<DetalheDeMetrica>(EVENTO_DE_METRICA, {
      detail: { rotulo, destino },
    }),
  );
}
