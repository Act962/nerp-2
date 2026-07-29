import { createSalesGoalBranch } from "./create-branch";
import { createSalesGoalEntry } from "./create-entry";
import { deleteSalesGoalBranch } from "./delete-branch";
import { deleteSalesGoalEntry } from "./delete-entry";
import { listSalesGoalEvolution } from "./evolution";
import { importSalesGoalRanking } from "./import";
import { listSalesGoalRanking } from "./list";
import { listSalesGoalPeriods } from "./list-periods";
import { publicListSalesGoalRanking } from "./public-list";
import { publicGetSalesGoalRankingSettings } from "./public-settings";
import { getSalesGoalRankingSettings } from "./settings/get";
import { updateSalesGoalRankingSettings } from "./settings/update";
import { updateSalesGoalBranch } from "./update-branch";
import { updateSalesGoalPeriod } from "./update-period";
import { upsertSalesGoalEntry } from "./upsert-entry";

export const rankingRouter = {
  list: listSalesGoalRanking,
  publicList: publicListSalesGoalRanking,
  publicSettings: publicGetSalesGoalRankingSettings,
  listPeriods: listSalesGoalPeriods,
  import: importSalesGoalRanking,
  createEntry: createSalesGoalEntry,
  upsertEntry: upsertSalesGoalEntry,
  deleteEntry: deleteSalesGoalEntry,
  createBranch: createSalesGoalBranch,
  updateBranch: updateSalesGoalBranch,
  deleteBranch: deleteSalesGoalBranch,
  updatePeriod: updateSalesGoalPeriod,
  evolution: listSalesGoalEvolution,
  settings: {
    get: getSalesGoalRankingSettings,
    update: updateSalesGoalRankingSettings,
  },
};
