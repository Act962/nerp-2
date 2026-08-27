"use client";

import { Input } from "@/components/ui/input";
import type { ProductGroup } from "../types";

// Campos de edição de um GRUPO DE PRODUTOS — grade, tamanho e aparência.
//
// Vive num componente próprio porque abre em DOIS lugares: no lápis da lateral
// ("Grupos da página") e no lápis da moldura do grupo no canvas. Duplicar o
// formulário garantiria que um dia os dois divergissem.

interface GroupSettingsFieldsProps {
  group: ProductGroup;
  onChange: (patch: Partial<ProductGroup>) => void;
}

export function GroupSettingsFields({
  group: g,
  onChange,
}: GroupSettingsFieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-medium text-muted-foreground">Grade</p>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
          Colunas
          <Input
            type="number"
            min={1}
            max={6}
            value={g.gridCols}
            onChange={(e) =>
              onChange({ gridCols: Math.max(1, Number(e.target.value) || 1) })
            }
            className="h-7"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
          Linhas
          <Input
            type="number"
            min={1}
            max={20}
            value={g.gridRows}
            onChange={(e) =>
              onChange({ gridRows: Math.max(1, Number(e.target.value) || 1) })
            }
            className="h-7"
          />
        </div>
      </div>

      <p className="mt-1 text-[11px] font-medium text-muted-foreground">
        Tamanho
      </p>
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
          Largura
          <Input
            type="number"
            min={40}
            max={1080}
            value={Math.round(g.rect.w)}
            onChange={(e) =>
              onChange({
                rect: {
                  ...g.rect,
                  w: Math.max(40, Number(e.target.value) || 40),
                },
              })
            }
            className="h-7"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
          Altura
          <Input
            type="number"
            min={40}
            value={Math.round(g.rect.h)}
            onChange={(e) =>
              onChange({
                rect: {
                  ...g.rect,
                  h: Math.max(40, Number(e.target.value) || 40),
                },
              })
            }
            className="h-7"
          />
        </div>
      </div>
      <p className="text-[10px] leading-tight text-muted-foreground">
        A altura é um mínimo: se os produtos não couberem, o grupo cresce
        sozinho.
      </p>

      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Espaçamento entre produtos ({g.gap ?? 16}px)
        <input
          type="range"
          min={0}
          max={64}
          value={g.gap ?? 16}
          onChange={(e) => onChange({ gap: Number(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Respiro interno ({g.padding ?? 0}px)
        <input
          type="range"
          min={0}
          max={64}
          value={g.padding ?? 0}
          onChange={(e) => onChange({ padding: Number(e.target.value) })}
        />
      </label>
      <p className="text-[10px] leading-tight text-muted-foreground">
        Afasta os produtos da borda — é o que faz a cor de fundo aparecer em
        volta deles, e não só nos vãos.
      </p>

      <p className="mt-1 text-[11px] font-medium text-muted-foreground">
        Aparência
      </p>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Transparência do fundo ({g.bgOpacity ?? 100}%)
        <input
          type="range"
          min={0}
          max={100}
          value={g.bgOpacity ?? 100}
          onChange={(e) => onChange({ bgOpacity: Number(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Arredondamento ({g.radius ?? 0}px)
        <input
          type="range"
          min={0}
          max={80}
          value={g.radius ?? 0}
          onChange={(e) => onChange({ radius: Number(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Contorno ({g.borderWidth ?? 0}px)
        <input
          type="range"
          min={0}
          max={20}
          value={g.borderWidth ?? 0}
          onChange={(e) => onChange({ borderWidth: Number(e.target.value) })}
        />
      </label>
      {(g.borderWidth ?? 0) > 0 && (
        <label className="flex items-center justify-between text-[11px] text-muted-foreground">
          Cor do contorno
          <input
            type="color"
            value={g.borderColor ?? "#000000"}
            onChange={(e) => onChange({ borderColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm"
          />
        </label>
      )}
    </div>
  );
}
