"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Datum {
  label: string;
  value: number;
}

// Gráfico de barras horizontais de uma seção: compara magnitudes de contagem
// com uma cor única (sem arco-íris) e rótulo direto por barra. Valores de moeda
// ficam de fora (escala diferente) — o dashboard mostra esses como número.
export function SectionChart({ data }: { data: Datum[] }) {
  const height = Math.max(90, data.length * 40 + 16);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 44, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-muted-foreground"
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground"
            fontSize={12}
            formatter={(value) =>
              typeof value === "number" ? value.toLocaleString("pt-BR") : value
            }
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
