"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { WidgetValue } from "../../lib/widget-value";

const CHART_CONFIG: ChartConfig = {
  value: { label: "Valor", color: "var(--chart-1)" },
};

const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ChartWidget({
  value,
  chartKind,
}: {
  value: Extract<WidgetValue, { kind: "CHART" }>;
  chartKind: "LINE" | "BAR" | "DONUT" | null;
}) {
  if (value.series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sem dados neste período.
      </p>
    );
  }

  if (chartKind === "DONUT") {
    return (
      <ChartContainer config={CHART_CONFIG} className="h-full w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={value.series}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            strokeWidth={2}
          >
            {value.series.map((entry, index) => (
              <Cell
                key={entry.label}
                fill={DONUT_COLORS[index % DONUT_COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    );
  }

  if (chartKind === "BAR") {
    return (
      <ChartContainer config={CHART_CONFIG} className="h-full w-full">
        <BarChart data={value.series}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={CHART_CONFIG} className="h-full w-full">
      <LineChart data={value.series}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
