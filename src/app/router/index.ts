import { categoryRoutes } from "./category";
import { orgRoutes } from "./org";
import { productsRoutes } from "./products";
import { catalogSettingsRouter } from "./catalog";
import { stockRoutes } from "./stock";
import { checkoutRouter } from "./checkout";
import { dashboardRoutes } from "./dashboard";
import { customerRoutes } from "./customer";
import { SalesRoutes } from "./sales";
import { kitchenRoutes } from "./pedidos";
import { collaboratorRoutes } from "./collaborators";
import { memberRoutes } from "./members";
import { promotionalCatalogRouter } from "./promotional-catalog";
import { rankingRouter } from "./ranking";
import { supplierRoutes } from "./supplier";
import { storeRoutes } from "./store";
import { brandRoutes } from "./brand";
import { floorPlanRoutes } from "./floor-plan";
import { mapLayerRoutes } from "./map-layer";
import { mapObjectRoutes } from "./map-object";
import { mapAnnotationRoutes } from "./map-annotation";
import { pdvPhotoRoutes } from "./pdv-photo";
import { bookRoutes } from "./book";
import { spaceNegotiationRoutes } from "./space-negotiation";
import { mediaTypeRoutes } from "./trade-catalog/media-type";
import { negotiationTypeRoutes } from "./trade-catalog/negotiation-type";
import { storeSectorRoutes } from "./trade-catalog/store-sector";
import { mediaTypePriceRoutes } from "./trade-catalog/media-type-price";
import { tradePricingSettingsRoutes } from "./trade-catalog/pricing-settings";
import { regionCostBenchmarkRoutes } from "./trade-catalog/region-benchmark";
import { catalogPdvRoutes } from "./trade-catalog/catalog-pdv";
import { tradeCatalogDocRoutes } from "./trade-catalog/catalog-doc";
import { mediaModelPhotoRoutes } from "./media-model-photo";
import { tradeCatalogSeedRoutes } from "./trade-catalog/seed";
import { invitationRoutes } from "./invitation";
import { promotorRoutes } from "./promotor";

export const router = {
  products: productsRoutes,
  categories: categoryRoutes,
  catalogSettings: catalogSettingsRouter,
  stocks: stockRoutes,
  org: orgRoutes,
  checkout: checkoutRouter,
  dashboard: dashboardRoutes,
  customer: customerRoutes,
  sales: SalesRoutes,
  kitchen: kitchenRoutes,
  collaborators: collaboratorRoutes,
  members: memberRoutes,
  promotionalCatalog: promotionalCatalogRouter,
  ranking: rankingRouter,
  supplier: supplierRoutes,
  store: storeRoutes,
  brand: brandRoutes,
  floorPlan: floorPlanRoutes,
  mapLayer: mapLayerRoutes,
  mapObject: mapObjectRoutes,
  mapAnnotation: mapAnnotationRoutes,
  pdvPhoto: pdvPhotoRoutes,
  promotor: promotorRoutes,
  book: bookRoutes,
  spaceNegotiation: spaceNegotiationRoutes,
  mediaType: mediaTypeRoutes,
  negotiationType: negotiationTypeRoutes,
  storeSector: storeSectorRoutes,
  mediaTypePrice: mediaTypePriceRoutes,
  tradePricingSettings: tradePricingSettingsRoutes,
  regionCostBenchmark: regionCostBenchmarkRoutes,
  catalogPdv: catalogPdvRoutes,
  tradeCatalogDoc: tradeCatalogDocRoutes,
  mediaModelPhoto: mediaModelPhotoRoutes,
  tradeCatalogSeed: tradeCatalogSeedRoutes,
  invitation: invitationRoutes,
};
