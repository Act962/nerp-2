"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useCreateRegionCostBenchmark,
  useDeleteRegionCostBenchmark,
  useRegionCostBenchmarks,
  useSelfBenchmark,
} from "../hooks/use-catalog-pdv";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ManualBenchmarkForm() {
  const create = useCreateRegionCostBenchmark();
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [costPerM2, setCostPerM2] = useState("");

  const handleSubmit = () => {
    const parsedCost = Number(costPerM2);
    if (state.trim().length !== 2 || !parsedCost || parsedCost <= 0) return;
    create.mutate(
      {
        state: state.trim(),
        city: city.trim() || undefined,
        costPerM2: parsedCost,
      },
      {
        onSuccess: () => {
          setState("");
          setCity("");
          setCostPerM2("");
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-20 space-y-1.5">
        <label htmlFor="benchmark-uf" className="text-xs text-muted-foreground">
          UF
        </label>
        <Input
          id="benchmark-uf"
          maxLength={2}
          value={state}
          onChange={(event) => setState(event.target.value.toUpperCase())}
          placeholder="SP"
        />
      </div>
      <div className="w-48 space-y-1.5">
        <label
          htmlFor="benchmark-cidade"
          className="text-xs text-muted-foreground"
        >
          Cidade (vazio = estadual)
        </label>
        <Input
          id="benchmark-cidade"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
      </div>
      <div className="w-36 space-y-1.5">
        <label
          htmlFor="benchmark-custo"
          className="text-xs text-muted-foreground"
        >
          Custo/m²
        </label>
        <Input
          id="benchmark-custo"
          type="number"
          min={0}
          step="0.01"
          value={costPerM2}
          onChange={(event) => setCostPerM2(event.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={create.isPending}
        onClick={handleSubmit}
      >
        Adicionar
      </Button>
    </div>
  );
}

export function RegionBenchmarkPanel() {
  const { benchmarks } = useRegionCostBenchmarks();
  const removeBenchmark = useDeleteRegionCostBenchmark();
  const { items: selfBenchmark } = useSelfBenchmark();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Benchmark regional (manual)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ManualBenchmarkForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UF</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Custo/m²</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {benchmarks.map((benchmark) => (
                <TableRow key={benchmark.id}>
                  <TableCell>{benchmark.state}</TableCell>
                  <TableCell>{benchmark.city || "(estadual)"}</TableCell>
                  <TableCell>{formatCurrency(benchmark.costPerM2)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {benchmark.source ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={removeBenchmark.isPending}
                      onClick={() =>
                        removeBenchmark.mutate({ id: benchmark.id })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Benchmark das suas lojas por cidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selfBenchmark.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cidade com 3+ lojas com área e custo cadastrados ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Lojas</TableHead>
                  <TableHead>Custo/m² médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selfBenchmark.map((cell) => (
                  <TableRow key={`${cell.state}-${cell.city}`}>
                    <TableCell>
                      {cell.city}/{cell.state}
                    </TableCell>
                    <TableCell>{cell.storeCount}</TableCell>
                    <TableCell>{formatCurrency(cell.avgCostPerM2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
