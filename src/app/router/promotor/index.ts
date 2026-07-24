import { capturePromotorPhoto } from "./capture";
import { listMyPromotorPhotos } from "./my-photos";
import { reverseGeocode } from "./reverse-geocode";
import { reviewPromotorPhoto } from "./review-photo";
import { listPhotosForApproval } from "./for-approval";
import { listApprovedForImport } from "./approved-for-import";

export const promotorRoutes = {
  capture: capturePromotorPhoto,
  myPhotos: listMyPromotorPhotos,
  reverseGeocode,
  reviewPhoto: reviewPromotorPhoto,
  forApproval: listPhotosForApproval,
  approvedForImport: listApprovedForImport,
};
