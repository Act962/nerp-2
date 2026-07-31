import { addDashboardWidget } from "./add-widget";
import { listDashboardWidgetCatalog } from "./catalog";
import { createDashboardManualMetric } from "./create-manual-metric";
import { createDashboardSalesGoal } from "./create-sales-goal";
import { deleteDashboardManualMetric } from "./delete-manual-metric";
import { deleteDashboardSalesGoal } from "./delete-sales-goal";
import { listDashboardManualMetrics } from "./list-manual-metrics";
import { listDashboardSalesGoals } from "./list-sales-goals";
import { listMyDashboardWidgets } from "./list-my-widgets";
import { drilldownOracleWidget } from "./drilldown";
import { refreshOracleWidget } from "./refresh-oracle-widget";
import { removeDashboardWidget } from "./remove-widget";
import { resolveDashboardWidgetValues } from "./resolve-values";
import { saveDashboardLayout } from "./save-layout";
import { updateDashboardManualMetric } from "./update-manual-metric";
import { updateDashboardSalesGoal } from "./update-sales-goal";
import { updateDashboardWidget } from "./update-widget";

export const dashboardWidgetsRoutes = {
  catalog: listDashboardWidgetCatalog,
  add: addDashboardWidget,
  update: updateDashboardWidget,
  remove: removeDashboardWidget,
  saveLayout: saveDashboardLayout,
  listMine: listMyDashboardWidgets,
  resolveValues: resolveDashboardWidgetValues,
  refreshOracle: refreshOracleWidget,
  drilldown: drilldownOracleWidget,
  manualMetrics: {
    list: listDashboardManualMetrics,
    create: createDashboardManualMetric,
    update: updateDashboardManualMetric,
    delete: deleteDashboardManualMetric,
  },
  salesGoals: {
    list: listDashboardSalesGoals,
    create: createDashboardSalesGoal,
    update: updateDashboardSalesGoal,
    delete: deleteDashboardSalesGoal,
  },
};
