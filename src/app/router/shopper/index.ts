import { shopperLogin, shopperMe, shopperSignup } from "./auth";
import { favoriteToggle, favoritesList, isFavorite } from "./favorites";

export const shopperRoutes = {
  signup: shopperSignup,
  login: shopperLogin,
  me: shopperMe,
  favoriteToggle,
  isFavorite,
  favoritesList,
};
