import { applyPromotorSeal } from "./apply-seal";
import { listApprovalGroups } from "./approval-groups";
import { capturePromotorPhoto } from "./capture";
import { listMyPromotorPhotos } from "./my-photos";
import { listMyIndustries } from "./my-industries";
import { listMyStores } from "./my-stores";
import { getMyPhotoCounts } from "./photo-counts";
import { listMyPhotoGroups } from "./photo-groups";
import { getPromotorProfile } from "./profile";
import { togglePromotorFavorite } from "./toggle-favorite";
import { updatePromotorProfile } from "./update-profile";
import { listMemberLinks } from "./list-member-links";
import { setMemberLinks } from "./set-member-links";
import { reverseGeocode } from "./reverse-geocode";
import { reportGeoState } from "./report-geo-state";
import { reviewPromotorPhoto } from "./review-photo";
import { listPhotosForApproval } from "./for-approval";
import { listApprovedForImport } from "./approved-for-import";
import { listGalleryDrafts } from "./gallery-drafts";
import { submitGalleryPhotos } from "./submit-gallery-photos";

export const promotorRoutes = {
  capture: capturePromotorPhoto,
  myPhotos: listMyPromotorPhotos,
  myIndustries: listMyIndustries,
  myStores: listMyStores,
  photoGroups: listMyPhotoGroups,
  photoCounts: getMyPhotoCounts,
  toggleFavorite: togglePromotorFavorite,
  profile: getPromotorProfile,
  updateProfile: updatePromotorProfile,
  memberLinks: listMemberLinks,
  setMemberLinks,
  reverseGeocode,
  reportGeoState,
  reviewPhoto: reviewPromotorPhoto,
  forApproval: listPhotosForApproval,
  approvalGroups: listApprovalGroups,
  applySeal: applyPromotorSeal,
  approvedForImport: listApprovedForImport,
  galleryDrafts: listGalleryDrafts,
  submitGalleryPhotos: submitGalleryPhotos,
};
