import { capturePromotorPhoto } from "./capture";
import { listMyPromotorPhotos } from "./my-photos";
import { listMyIndustries } from "./my-industries";
import { listMemberLinks } from "./list-member-links";
import { setMemberLinks } from "./set-member-links";
import { reverseGeocode } from "./reverse-geocode";
import { reviewPromotorPhoto } from "./review-photo";
import { listPhotosForApproval } from "./for-approval";
import { listApprovedForImport } from "./approved-for-import";

export const promotorRoutes = {
  capture: capturePromotorPhoto,
  myPhotos: listMyPromotorPhotos,
  myIndustries: listMyIndustries,
  memberLinks: listMemberLinks,
  setMemberLinks,
  reverseGeocode,
  reviewPhoto: reviewPromotorPhoto,
  forApproval: listPhotosForApproval,
  approvedForImport: listApprovedForImport,
};
