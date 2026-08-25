import { listCoupons, redeemCoupon } from "./coupons";
import { createInterest } from "./create-interest";
import { getPublicCompany } from "./company";
import { getPublicGroup } from "./group";
import { getPublicMapPoints } from "./map-points";
import { getMarketSize } from "./market-size";
import { resolveTradegramSlug } from "./resolve-slug";
import { identifyProduct } from "./identify-product";
import { locateProduct } from "./locate-product";
import { logScan } from "./log-scan";
import { lookupBarcode } from "./lookup-barcode";
import { searchPublic } from "./search";
import { getPublicStore } from "./store";
import { getPublicStoreMap } from "./store-map";
import { getPublicStoreMedia } from "./store-media";

export const tradegramPublicRoutes = {
  getPublicGroup,
  getPublicCompany,
  getPublicMapPoints,
  marketSize: getMarketSize,
  resolveSlug: resolveTradegramSlug,
  getPublicStore,
  getPublicStoreMap,
  getPublicStoreMedia,
  search: searchPublic,
  createInterest,
  lookupBarcode,
  locateProduct,
  logScan,
  listCoupons,
  redeemCoupon,
  identifyProduct,
};
