import { listCoupons, redeemCoupon } from "./coupons";
import { createInterest } from "./create-interest";
import { getPublicGroup } from "./group";
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
