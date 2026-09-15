/**
 * Uma foto da tela como ela está agora, para acompanhar o pedido de melhoria.
 *
 * Print é o que transforma "a tela tá estranha" em algo acionável, e pedir que
 * a pessoa saiba tirar um, achar o arquivo e anexar é onde metade dos pedidos
 * morre.
 *
 * O painel do Astro e o balão da jornada ficam de fora da imagem: eles estão
 * por cima justamente do que a pessoa quer mostrar.
 *
 * A biblioteca entra por import dinâmico — são ~30 kB que só interessam a quem
 * abre o formulário de melhorias.
 */
const FORA_DA_FOTO =
  ".o-astro-panel, .o-astro-btn, .jornada-balao, .jornada-anel, .jornada-convite, [data-melhorias-dialog]";

export async function capturarTela(): Promise<File | null> {
  if (typeof document === "undefined") return null;
  try {
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(document.body, {
      pixelRatio: 1,
      filter: (node) => {
        if (!(node instanceof Element)) return true;
        return !node.closest(FORA_DA_FOTO);
      },
    });
    if (!blob) return null;
    return new File([blob], `tela-${Date.now()}.png`, { type: "image/png" });
  } catch {
    // Uma imagem de outra origem sem CORS derruba o `toBlob` inteiro. Quem
    // chama avisa e segue: o texto do pedido vale mesmo sem a foto.
    return null;
  }
}
