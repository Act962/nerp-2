import { createCategory } from "./create";
import { deleteCategory } from "./delete";
import { duplicateCategory } from "./duplicate";
import { listCategories } from "./list";
import { listAllCategories } from "./list-all";
import { listCategoryTree } from "./list-tree";
import { listWithoutSubcategory } from "./list-without-sub";
import { updateCategory } from "./update";

export const categoryRoutes = {
  list: listCategories,
  listAll: listAllCategories,
  listTree: listCategoryTree,
  listWithoutSubcategory: listWithoutSubcategory,
  create: createCategory,
  update: updateCategory,
  duplicate: duplicateCategory,
  delete: deleteCategory,
};
