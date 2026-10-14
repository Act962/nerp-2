import { describe, expect, it } from "vitest";
import { fotoDoProduto, temFotoCadastrada } from "./foto-do-produto";

describe("fotoDoProduto", () => {
  it("usa a miniatura quando ela existe", () => {
    expect(
      fotoDoProduto({
        thumbnail: "produtos/a.jpg",
        images: ["produtos/b.jpg"],
      }),
    ).toBe("produtos/a.jpg");
  });

  it("cai na primeira foto da galeria quando falta a miniatura", () => {
    expect(
      fotoDoProduto({ thumbnail: "", images: ["", "  ", "produtos/b.jpg"] }),
    ).toBe("produtos/b.jpg");
  });

  it("não conta espaço em branco como foto", () => {
    expect(fotoDoProduto({ thumbnail: "   ", images: [" "] })).toBe("");
    expect(fotoDoProduto({ thumbnail: null, images: null })).toBe("");
  });
});

describe("temFotoCadastrada", () => {
  it("considera a galeria, não só a miniatura", () => {
    expect(
      temFotoCadastrada({ thumbnail: "", images: ["produtos/b.jpg"] }),
    ).toBe(true);
    expect(temFotoCadastrada({ thumbnail: "", images: [] })).toBe(false);
  });
});
