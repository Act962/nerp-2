import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { pdfSafeImageUrl } from "./crop-photo";

// Regressão da capa que saía sem a logo da indústria: o arquivo era .webp, o
// react-pdf não decodifica webp e descartava o elemento em silêncio.

async function webp(opacity: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 200, g: 20, b: 30, alpha: opacity },
    },
  })
    .webp()
    .toBuffer();
}

function mockFetch(body: Buffer) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pdfSafeImageUrl", () => {
  it("deixa passar o que o react-pdf já decodifica, sem baixar nada", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const urls = [
      "https://cdn/logo.png",
      "https://cdn/logo.JPG",
      "https://cdn/foto.jpeg",
      "https://cdn/logo.png?v=2",
      "data:image/png;base64,AAAA",
      "",
    ];
    for (const url of urls) {
      expect(await pdfSafeImageUrl(url)).toBe(url);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converte webp com transparência em PNG embutido", async () => {
    mockFetch(await webp(0.5));

    const resultado = await pdfSafeImageUrl("https://cdn/logo.svg.webp");

    expect(resultado.startsWith("data:image/png;base64,")).toBe(true);
    const convertida = Buffer.from(resultado.split(",")[1], "base64");
    const meta = await sharp(convertida).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
  });

  it("converte webp opaco em JPEG, que pesa menos", async () => {
    mockFetch(await webp(1));

    const resultado = await pdfSafeImageUrl("https://cdn/fundo.webp");

    expect(resultado.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("devolve a URL original quando o download falha, sem derrubar o PDF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(await pdfSafeImageUrl("https://cdn/logo.webp")).toBe(
      "https://cdn/logo.webp",
    );
  });
});
