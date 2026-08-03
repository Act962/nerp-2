import { createStoreAtPoint } from "./create-store-at";
import {
  listDirectoryDuplicates,
  listDirectoryReview,
  mergeDirectoryStores,
  reviewDirectoryStore,
} from "./directory-review";
import { listDirectoryStores } from "./directory-stores";
import { importOsmStores } from "./import-osm-stores";
import { getPromoterPositions } from "./promoter-positions";
import { listMapPromoters } from "./promoters";
import { reconcileStores } from "./reconcile-stores";
import { searchOsmStores } from "./search-osm-stores";
import { searchFieldStores } from "./search-stores";
import { searchMapPlaces } from "./search-places";
import { setDirectoryStoreLogo } from "./set-directory-logo";
import { setStoreLogo } from "./set-store-logo";
import { listMapStores } from "./stores";
import { getFieldTrail } from "./trail";

export const fieldMapRoutes = {
  stores: listMapStores,
  directoryStores: listDirectoryStores,
  directoryReview: listDirectoryReview,
  directoryDuplicates: listDirectoryDuplicates,
  mergeDirectoryStores,
  reviewDirectoryStore,
  reconcileStores,
  promoters: listMapPromoters,
  promoterPositions: getPromoterPositions,
  trail: getFieldTrail,
  createStoreAt: createStoreAtPoint,
  searchStores: searchFieldStores,
  searchOsm: searchOsmStores,
  searchPlaces: searchMapPlaces,
  importOsm: importOsmStores,
  setStoreLogo,
  setDirectoryLogo: setDirectoryStoreLogo,
};
