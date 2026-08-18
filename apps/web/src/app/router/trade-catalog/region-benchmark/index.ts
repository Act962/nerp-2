import { createRegionCostBenchmark } from "./create";
import { deleteRegionCostBenchmark } from "./delete";
import { listRegionCostBenchmark } from "./list";
import { selfBenchmarkRegionCost } from "./self-benchmark";
import { updateRegionCostBenchmark } from "./update";

export const regionCostBenchmarkRoutes = {
  list: listRegionCostBenchmark,
  create: createRegionCostBenchmark,
  update: updateRegionCostBenchmark,
  delete: deleteRegionCostBenchmark,
  selfBenchmark: selfBenchmarkRegionCost,
};
