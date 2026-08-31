import { createBook } from "./create";
import { listBook } from "./list";
import { getBook } from "./get";
import { updateBook } from "./update";
import { deleteBook } from "./delete";
import { importBookPhotos } from "./import-photos";
import { removeBookItem } from "./remove-item";
import { reorderBookItems } from "./reorder-items";
import { generateBookPdf } from "./generate";
import { updateBookCoverLayout } from "./update-cover-layout";
import { getDefaultCoverTemplate } from "./get-default-cover-template";
import { setDefaultCoverTemplate } from "./set-default-cover-template";
import { listSupplierBrands } from "./list-supplier-brands";
import { addBookPage } from "./add-page";
import { changeBookPageLayout } from "./change-page-layout";
import { updateBookPageLayout } from "./update-page-layout";
import { updateBookItemLayout } from "./update-item-layout";
import { listBookTemplates } from "./list-templates";
import { saveBookTemplate } from "./save-template";
import { deleteBookTemplate } from "./delete-template";
import { applyBookTemplate } from "./apply-template";
import { getTemplateForBook } from "./get-template-for-book";
import { listBookPageTemplates } from "./list-page-templates";
import { saveBookPageTemplate } from "./save-page-template";
import { applyBookPageTemplate } from "./apply-page-template";
import { deleteBookPageTemplate } from "./delete-page-template";
import { reviewBookItem } from "./review-item";
import { sendBook } from "./send-book";
import { bookDashboard } from "./dashboard";
import { bookApprovalInsights } from "./approval-insights";
import { duplicateBookPage } from "./duplicate-page";
import { autoGenerateBook } from "./auto-generate";
import { autoGeneratePreview } from "./auto-generate-preview";
import { setSlotPhoto } from "./set-slot-photo";
import { uploadSlotPhoto } from "./upload-slot-photo";
import { setSlotAdjustment } from "./set-slot-adjustment";
import { getBookPageTemplate } from "./get-page-template";
import { updateBookPageTemplate } from "./update-page-template";
import { updateBookPageOwnLayout } from "./update-book-page-layout";
import { listTemplateIndustries } from "./list-template-industries";
import { listIndustryTemplates } from "./list-industry-templates";
import { createIndustryTemplate } from "./create-industry-template";
import { createIndustryBase } from "./create-industry-base";
import { reapplyIndustryBase } from "./reapply-industry-base";
import { addBookExtraPage } from "./add-extra-page";
import { reorderBookPages } from "./reorder-pages";
import { deleteBookPage } from "./delete-page";

export const bookRoutes = {
  list: listBook,
  create: createBook,
  getOne: getBook,
  update: updateBook,
  delete: deleteBook,
  importPhotos: importBookPhotos,
  removeItem: removeBookItem,
  reorderItems: reorderBookItems,
  generate: generateBookPdf,
  updateCoverLayout: updateBookCoverLayout,
  getDefaultCoverTemplate: getDefaultCoverTemplate,
  setDefaultCoverTemplate: setDefaultCoverTemplate,
  listSupplierBrands: listSupplierBrands,
  addPage: addBookPage,
  changePageLayout: changeBookPageLayout,
  updatePageLayout: updateBookPageLayout,
  updateItemLayout: updateBookItemLayout,
  listTemplates: listBookTemplates,
  saveTemplate: saveBookTemplate,
  deleteTemplate: deleteBookTemplate,
  applyTemplate: applyBookTemplate,
  getTemplateForBook: getTemplateForBook,
  listPageTemplates: listBookPageTemplates,
  savePageTemplate: saveBookPageTemplate,
  applyPageTemplate: applyBookPageTemplate,
  deletePageTemplate: deleteBookPageTemplate,
  reviewItem: reviewBookItem,
  send: sendBook,
  dashboard: bookDashboard,
  approvalInsights: bookApprovalInsights,
  duplicatePage: duplicateBookPage,
  autoGenerate: autoGenerateBook,
  autoGeneratePreview: autoGeneratePreview,
  setSlotPhoto: setSlotPhoto,
  uploadSlotPhoto: uploadSlotPhoto,
  setSlotAdjustment: setSlotAdjustment,
  getPageTemplate: getBookPageTemplate,
  updatePageTemplate: updateBookPageTemplate,
  updateBookPageLayout: updateBookPageOwnLayout,
  listTemplateIndustries: listTemplateIndustries,
  listIndustryTemplates: listIndustryTemplates,
  createIndustryTemplate: createIndustryTemplate,
  createIndustryBase: createIndustryBase,
  reapplyIndustryBase: reapplyIndustryBase,
  addExtraPage: addBookExtraPage,
  reorderPages: reorderBookPages,
  deletePage: deleteBookPage,
};
