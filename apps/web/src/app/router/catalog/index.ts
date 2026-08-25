import { createSettingsCatalog } from "./create";
import { getUserCatalog } from "./get-user";
import { listSettingsCatalog } from "./list";
import { listProductsOfCart } from "./list-my-products";
import { listProducts } from "./list-products";
import { loginCatalog } from "./login";
import { getProductAndProductsByCategory } from "./product_with_category";
import { publicSettingsCatalog } from "./public";
import { signupCatalog } from "./signup";
import { updateSettingsCatalog } from "./update";
import { updateCustomer } from "./update-customer";

export const catalogSettingsRouter = {
  create: createSettingsCatalog,
  list: listSettingsCatalog,
  public: publicSettingsCatalog,
  update: updateSettingsCatalog,
  relatedProducts: getProductAndProductsByCategory,
  listProducts: listProducts,
  loginCatalog: loginCatalog,
  signupCatalog: signupCatalog,
  getUser: getUserCatalog,
  updateCustomer: updateCustomer,
  listProductsOfCart: listProductsOfCart,
};
