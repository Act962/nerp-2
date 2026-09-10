"use client";

import { useEffect, useState } from "react";
import { CategoryFormDialog } from "../modals/category/category-form-dialog";
import { DeleteCategoryDialog } from "../modals/category/delete-category";
import { DeleteProductModal } from "../modals/product/delete-product-modal";
import { LimiteDoPlanoDialog } from "@/features/billing/components/limite-do-plano-dialog";
import { VincularContaDialog } from "@/features/onboarding/components/vincular-conta-dialog";

export function ModalProvider() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }
  return (
    <>
      <CategoryFormDialog />
      <DeleteCategoryDialog />
      <DeleteProductModal />
      <LimiteDoPlanoDialog />
      <VincularContaDialog />
    </>
  );
}
