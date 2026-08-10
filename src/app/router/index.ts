import { categoryRoutes } from "./category";
import { orgRoutes } from "./org";
import { productsRoutes } from "./products";
import { catalogSettingsRouter } from "./catalog";
import { stockRoutes } from "./stock";
import { checkoutRouter } from "./checkout";
import { dashboardRoutes } from "./dashboard";
import { customerRoutes } from "./customer";
import { SalesRoutes } from "./sales";
import { caixaRoutes } from "./caixa";
import { cashRegisterRoutes } from "./cash-register";
import { pdvMediaRoutes } from "./pdv-media";
import { pdvSettingsRoutes } from "./pdv-settings";
import { cancelRequestRoutes } from "./cancel-request";
import { financeiroRoutes } from "./financeiro";
import { receiptTemplateRoutes } from "./receipt-template";
import { kitchenRoutes } from "./pedidos";
import { collaboratorRoutes } from "./collaborators";
import { calendarRoutes } from "./calendar";
import { fieldMapRoutes } from "./field-map";
import { promoterRouteRoutes } from "./promoter-route";
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
import { planogramRoutes } from "./planogram";
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
import { billingRoutes } from "./billing";
import { couponRoutes } from "./coupon";
import { directoryRoutes } from "./directory";
import { distributorRoutes } from "./distributor";
import { shopperRoutes } from "./shopper";
import { shopperInsightsRoutes } from "./shopper-insights";
import { storeInventoryRoutes } from "./store-inventory";
import { tradegramPublicRoutes } from "./tradegram-public";
import { tradeDashboardRoutes } from "./trade-dashboard";
import { tradeInterestRoutes } from "./trade-interest";
import { erpSyncRoutes } from "./erp-sync";
import { fiscalConfigRoutes } from "./fiscal-config";
import { oracleExplorerRoutes } from "./oracle-explorer";
import { dashboardWidgetsRoutes } from "./dashboard-widgets";
import { orgDashboardRoutes } from "./org-dashboard";

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
  caixa: caixaRoutes,
  cashRegister: cashRegisterRoutes,
  pdvMedia: pdvMediaRoutes,
  pdvSettings: pdvSettingsRoutes,
  cancelRequest: cancelRequestRoutes,
  financeiro: financeiroRoutes,
  receiptTemplate: receiptTemplateRoutes,
  kitchen: kitchenRoutes,
  collaborators: collaboratorRoutes,
  calendar: calendarRoutes,
  fieldMap: fieldMapRoutes,
  promoterRoute: promoterRouteRoutes,
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
  planogram: planogramRoutes,
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
  tradegramPublic: tradegramPublicRoutes,
  tradeDashboard: tradeDashboardRoutes,
  tradeInterest: tradeInterestRoutes,
  distributor: distributorRoutes,
  directory: directoryRoutes,
  billing: billingRoutes,
  shopper: shopperRoutes,
  coupon: couponRoutes,
  storeInventory: storeInventoryRoutes,
  shopperInsights: shopperInsightsRoutes,
  erpSync: erpSyncRoutes,
  fiscalConfig: fiscalConfigRoutes,
  oracleExplorer: oracleExplorerRoutes,
  dashboardWidgets: dashboardWidgetsRoutes,
  orgDashboard: orgDashboardRoutes,
};
