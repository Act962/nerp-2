import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LayoutPreview } from "./layout-preview";

// Um espaço de foto ocupado — o mínimo para a tarja "FOTO N" ter o que numerar.
const LAYOUT = [
  {
    id: "slot-0",
    type: "photoSlot",
    slotIndex: 0,
    x: 40,
    y: 100,
    width: 880,
    height: 420,
    rotation: 0,
    objectFit: "cover",
    cornerRadius: 0,
  },
];

const PHOTOS = ["https://exemplo.test/foto.jpg"];
const NUMEROS = { 0: 7 };

function renderPreview(props: {
  showPhotoNumbers?: boolean;
  slotShowNumber?: boolean;
}) {
  const layout = [
    {
      ...LAYOUT[0],
      ...(props.slotShowNumber === undefined
        ? {}
        : { showNumber: props.slotShowNumber }),
    },
  ];
  render(
    <LayoutPreview
      layout={layout}
      background={{ color: "#ffffff", opacity: 1 }}
      photoUrls={PHOTOS}
      photoNumbers={NUMEROS}
      showPhotoNumbers={props.showPhotoNumbers}
    />,
  );
}

describe("LayoutPreview — tarja FOTO N", () => {
  it("mostra a tarja por padrão", () => {
    renderPreview({});
    expect(screen.getByText("FOTO 7")).toBeInTheDocument();
  });

  // O interruptor do book, que é o ponto desta mudança: desliga tudo de uma vez
  // em vez de exigir desmarcar espaço por espaço em cada página.
  it("o interruptor do book esconde a tarja mesmo com o slot ligado", () => {
    renderPreview({ showPhotoNumbers: false, slotShowNumber: true });
    expect(screen.queryByText("FOTO 7")).not.toBeInTheDocument();
  });

  it("o slot continua valendo como exceção enquanto o book está ligado", () => {
    renderPreview({ showPhotoNumbers: true, slotShowNumber: false });
    expect(screen.queryByText("FOTO 7")).not.toBeInTheDocument();
  });

  it("slot sem número não mostra tarja", () => {
    render(
      <LayoutPreview
        layout={LAYOUT}
        background={{ color: "#ffffff", opacity: 1 }}
        photoUrls={PHOTOS}
      />,
    );
    expect(screen.queryByText(/^FOTO /)).not.toBeInTheDocument();
  });
});
