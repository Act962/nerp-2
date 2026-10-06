/**
 * O aviso de que a cena de `/solucoes` já está desenhada.
 *
 * Quem ouve é o painel de soluções, quando chega cobrindo a tela (ver
 * `mega-menu.tsx`): ele só sobe depois deste aviso. Montar os planetas trava a
 * página por um instante — as texturas são geradas na hora —, e uma cortina
 * que sobe nesse meio-tempo engasga no caminho e revela a cena pela metade.
 *
 * É um evento na janela, e não uma prop, porque os dois lados não se conhecem:
 * o painel mora no cabeçalho, a cena mora na página.
 */
export const CENA_PRONTA = "orbita:cena-pronta";
