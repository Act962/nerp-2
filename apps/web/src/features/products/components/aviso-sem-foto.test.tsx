import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvisoSemFoto } from "./aviso-sem-foto";

describe("AvisoSemFoto", () => {
  it("avisa que o produto sem foto não aparece no catálogo", () => {
    render(<AvisoSemFoto temFoto={false} />);
    expect(
      screen.getByText("Sem foto, o produto não aparece no catálogo."),
    ).toBeInTheDocument();
  });

  it("some quando o produto tem foto", () => {
    const { container } = render(<AvisoSemFoto temFoto />);
    expect(container).toBeEmptyDOMElement();
  });
});
