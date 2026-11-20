type ComFotos = {
  thumbnail: string | null;
  images?: readonly string[] | null;
};

/**
 * A foto que a vitrine mostra: a miniatura ou, sem ela, a primeira da galeria.
 *
 * É a mesma definição de "tem imagem" do filtro de produtos
 * (`missing-filters.ts`): ter uma das duas já rende foto. Contar só a
 * miniatura escondia da vitrine o produto que tem foto só na galeria — o
 * `set-images` só preenche a miniatura quando pedem.
 */
export function fotoDoProduto(produto: ComFotos): string {
  const miniatura = produto.thumbnail?.trim();
  if (miniatura) return miniatura;
  return produto.images?.find((foto) => foto.trim() !== "")?.trim() ?? "";
}

export function temFotoCadastrada(produto: ComFotos): boolean {
  return fotoDoProduto(produto) !== "";
}
