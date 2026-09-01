"use client";

/**
 * Os ícones do menu.
 *
 * Traço fino, pontas arredondadas, grade de 24 — o mesmo espírito dos ícones
 * de segmento do material da marca. São desenhos, não uma fonte de ícones:
 * assim herdam `currentColor` e não custam requisição nenhuma.
 *
 * Cada desenho diz o que a ferramenta faz, não a categoria a que ela pertence.
 * Quem procura "o do financeiro" reconhece a nota antes de ler "Payment".
 */

const TOOL_PATHS: Record<string, string> = {
  tracking: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v11h-4z",
  chat: "M20 12a7 7 0 0 1-10 6.3L4 20l1.7-6A7 7 0 1 1 20 12z",
  forms: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5",
  agendas:
    "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M8 3v4M16 3v4",
  forge: "M6 3h8l4 4v9H6zM14 3v4h4M5 20c2-2 3 1 5-1s3 1 5-1 3 1 4 0",
  workspaces:
    "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 4v16M3 10h6M9 14h12",
  payment:
    "M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4",
  nbox: "M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 8l2-4h6l1 4M12 8l1-4h6l2 4M10 13h4",
  ranking: "M8 21V11h4v10zM3 21v-6h5v6zM16 21V7h5v14zM2 21h20",
  planner:
    "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M8 3v4M16 3v4M12 13l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z",
  pages:
    "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M6.5 6.5h.01M9 6.5h.01M8 13h8M8 16h5",
  linnker:
    "M10 13a4 4 0 0 0 5.7.4l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.4 1.4M14 11a4 4 0 0 0-5.7-.4l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.4-1.4",
  comments:
    "M21 11.5a7 7 0 0 1-10 6.3L5 20l1.7-5.4A7 7 0 1 1 21 11.5zM14 11.5a2 2 0 1 0-2 2c2.4 0 3-1.7 3-3a4 4 0 1 0-2.6 3.8",
  disparo: "M21 3L3 10.5l7 2.8L12.8 21zM21 3l-11 10.3",
  astro:
    "M12 3l1.9 4.4L18 9l-4.1 1.6L12 15l-1.9-4.4L6 9l4.1-1.6zM18.5 16l.7 1.6 1.8.6-1.8.6-.7 1.7-.7-1.7-1.8-.6 1.8-.6zM5 15l.5 1.2L7 16.7l-1.5.5L5 18.5l-.5-1.3L3 16.7l1.5-.5z",
  "space-station": "M3 21V8l6-4 6 4v13M15 12h6v9M2 21h20M6 11h3M6 15h3M18 16h1",
  route:
    "M12 4L2 8.5l10 4.5 10-4.5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 8.5V15",
  tradegram:
    "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M9 9v12M13 13.5l2 2 3-3.5",
  nerp: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
};

const SEGMENT_PATHS: Record<string, string> = {
  supermercados:
    "M5 9h14l-1.4 9.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8zM9 9L11 4M15 9l-2-5M9.5 12.5v4M12 12.5v4M14.5 12.5v4",
  clinicas:
    "M6 3v6a6 6 0 0 0 12 0V3M4 3h4M16 3h4M12 15v2a4 4 0 0 0 8 0v-1M22 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  atacarejos:
    "M3 4h2.5l3 11.5M6.5 8.5l11-3 2.5 8.5-11 3zM12.5 12.2V8.4M12.5 8.4l-1.6 1.7M12.5 8.4l1.6 1.7M11.1 19.5a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z",
  franquias:
    "M4 9h16v11H4zM3 9l1.6-4h14.8L21 9M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0M8 13h3v7H8zM14 13h3v3h-3z",
  food: "M4 9c0-2.8 3.6-5 8-5s8 2.2 8 5zM3.5 12.5c1.5 0 1.5 1.6 3 1.6s1.5-1.6 3-1.6 1.5 1.6 3 1.6 1.5-1.6 3-1.6 1.5 1.6 3 1.6M4 17h16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 6.5h.01M13 6h.01M16 7h.01",
  automotivo:
    "M4 16h16v3h-3v-3M7 19H4v-3M3.5 16l1.6-5A2 2 0 0 1 7 9.6h10a2 2 0 0 1 1.9 1.4l1.6 5zM6 9.6L7 6h10l1 3.6M6.5 13h2M15.5 13h2",
};

/* Os itens do painel "Sobre nós". */
const ABOUT_PATHS: Record<string, string> = {
  sobre: "M3 21V7l7-4 7 4v14M3 21h18M8 12h4M8 16h4M17 13h4v8",
  trabalhe:
    "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6M12 12v5M9.5 14.5h5",
  cases: "M4 20V10M9.5 20V5M15 20v-7M20.5 20V8M3 20h18",
  parceiros:
    "M9.6 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4M14.4 7.3a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4",
  treinamentos:
    "M12 6.5C10.5 5 8.5 4.4 4 4.4v13c4.5 0 6.5.6 8 2.1 1.5-1.5 3.5-2.1 8-2.1v-13c-4.5 0-6.5.6-8 2.1zM12 6.5v13",
};

function draw(d: string | undefined, size: number, width: number) {
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/** Ícone de uma ferramenta da suíte, pelo id dela no catálogo. */
export function ToolIcon({ id, size = 22 }: { id: string; size?: number }) {
  return draw(TOOL_PATHS[id], size, 1.6);
}

/** Ícone de um segmento, pelo id dele. */
export function SegmentIcon({ id, size = 40 }: { id: string; size?: number }) {
  return draw(SEGMENT_PATHS[id], size, 1.5);
}

/** Ícone de um item do painel "Sobre nós". */
export function AboutIcon({ id, size = 22 }: { id: string; size?: number }) {
  return draw(ABOUT_PATHS[id], size, 1.6);
}

/** O glifo do WhatsApp — preenchido, como a marca pede. */
export function WhatsAppGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29z" />
    </svg>
  );
}
