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
import { duplicateBookPage } from "./duplicate-page";

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
  duplicatePage: duplicateBookPage,
};
