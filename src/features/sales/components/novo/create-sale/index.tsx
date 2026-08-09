"use client";

import { useRef, useState } from "react";
import { SelectCustomerDialog } from "../select-customer-dialog";
import { PaymentDialog } from "../payment-dialog";
import { SaleCompletedDialog } from "../sale-completed-dialog";
import { useProducts } from "@/features/products/hooks/use-products";
import type { PersonType } from "@/schemas/customer";
import { ProductSection } from "./product-section";
import { CartSale } from "./cart-sale";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { type SaleFormData, saleSchema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationCreateSale } from "@/features/sales/hooks/use-sales";
import type { ReceiptSaleData } from "@/features/receipt-designer/lib/types";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";

export interface CustomerSales {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  personType: PersonType;
}

export type CartItem = {
  id: string;
  name: string;
  currentStock: number;
  sku: string | null;
  price: number;
  quantity: number;
};

export interface ProductSale {
  id: string;
  name: string;
  image: string | null;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  costPrice: number;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  maxStock?: number;
}

type ViewMode = "grid" | "list";

export default function CreateSalePage() {
  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      cartItems: [],
      customer: undefined,
      discount: 0,
      discountType: "percent",
      paymentMethod: PaymentMethod.DINHEIRO,
    },
  });

  const [searchTerm, setSearchTerm] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Dialogs
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [completedDialogOpen, setCompletedDialogOpen] = useState(true);
  const [completedSale, setCompletedSale] = useState<{
    saleNumber: number;
    total: number;
    paymentMethod: string;
    change: number;
    customerName: string | null;
    invoiceGenerated: boolean;
  } | null>(null);
  const [completedReceipt, setCompletedReceipt] =
    useState<ReceiptSaleData | null>(null);

  const cartItems = form.watch("cartItems");
  const discount = form.watch("discount");
  const discountType = form.watch("discountType");
  const customer = form.watch("customer");

  // Barcode scanner
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { cursor, pageIndex, hasPrevious, goNext, goPrevious } =
    useCursorPagination();

  const {
    hasNextPage,
    data: products,
    nextCursor,
    isLoading,
  } = useProducts({
    cursor,
    limit: 12,
  });

  const mutation = useMutationCreateSale();

  useBarcodeScan(true, (barcode) => {
    setSearchTerm(barcode);
  });

  const filteredProducts = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm),
  );

  const addToCart = (product: ProductSale) => {
    const currentCart = form.getValues("cartItems");
    const existingItem = currentCart.find((item) => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity < product.currentStock) {
        form.setValue(
          "cartItems",
          currentCart.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ),
        );
      }
    } else {
      form.setValue("cartItems", [
        ...currentCart,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: Number(product.salePrice),
          quantity: 1,
          currentStock: Number(product.currentStock),
        },
      ]);
    }
  };
  const updateQuantity = (id: string, delta: number) => {
    const currentCart = form.getValues("cartItems");
    const updatedCart = currentCart
      .map((item) => {
        if (item.id === id) {
          const cartItem = cartItems.find((item) => item.id === id);
          if (cartItem) {
            return { ...item, quantity: item.quantity + delta };
          }
        }
        return item;
      })
      .filter((item) => item.quantity > 0);
    form.setValue("cartItems", updatedCart);
  };

  const setItemQuantity = (id: string, quantity: number) => {
    const currentCart = form.getValues("cartItems");
    const updatedCart = currentCart
      .map((item) => {
        if (item.id === id) {
          const cartItem = cartItems.find((item) => item.id === id);
          if (cartItem) {
            return { ...item, quantity: quantity };
          }
        }
        return item;
      })
      .filter((item) => item.quantity > 0);
    form.setValue("cartItems", updatedCart);
  };

  const removeItem = (id: string) => {
    const currentCart = form.getValues("cartItems");
    form.setValue(
      "cartItems",
      currentCart.filter((item) => item.id !== id),
    );
  };

  const clearCart = () => {
    form.reset();
  };

  const handleOpenPayment = async () => {
    const allFields = [
      "cartItems",
      "customer",
      "discount",
      "discountType",
    ] as const;
    const isValid = await form.trigger(allFields);

    if (isValid) {
      setPaymentDialogOpen(true);
    } else {
      console.log(form.formState.errors);
    }
  };

  const subtotal = form
    .getValues("cartItems")
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const discountAmount =
    form.getValues("discountType") === "percent"
      ? (subtotal * form.getValues("discount")) / 100
      : form.getValues("discount");
  const total = Math.max(0, subtotal - discountAmount);

  const handlePaymentConfirm = (data: {
    paymentMethod: string;
    amountPaid: number;
    change: number;
    generateInvoice: boolean;
    printReceipt: boolean;
  }) => {
    // Generate sale number

    const { cartItems, customer, discount, discountType, paymentMethod } =
      form.getValues();

    const saleSubtotal = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const saleDiscountAmount =
      discountType === "percent" ? (saleSubtotal * discount) / 100 : discount;
    const saleTotal = Math.max(0, saleSubtotal - saleDiscountAmount);

    const receiptItems = cartItems.map((item) => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.price * item.quantity,
    }));

    const items = cartItems.map((item) => ({
      productId: item.id,
      productName: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
    }));
    mutation.mutate(
      {
        items,
        customerId: customer?.id,
        discount,
        subtotal,
        total,
        status: SaleStatus.COMPLETED,
        paymentMethod: paymentMethod,
      },
      {
        onSuccess: (sale) => {
          setCompletedSale({
            saleNumber: sale.saleNumber,
            total: saleTotal,
            paymentMethod: data.paymentMethod,
            change: data.change,
            customerName: customer?.name || null,
            invoiceGenerated: data.generateInvoice,
          });
          setCompletedReceipt({
            org: { name: "" },
            sale: {
              number: sale.saleNumber,
              date: new Date().toISOString(),
              customerName: customer?.name || null,
            },
            items: receiptItems,
            subtotal: saleSubtotal,
            discount: saleDiscountAmount,
            total: saleTotal,
            payments: [{ method: data.paymentMethod, amount: saleTotal }],
            amountPaid: data.amountPaid,
            change: data.change,
          });
          clearCart();
          setPaymentDialogOpen(false);
          setCompletedDialogOpen(true);
        },
        onError: (error) => {
          console.error(error);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {/* Left Side - Product Selection */}
        <ProductSection
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPrevious}
          pageIndex={pageIndex}
          onNextPage={() => goNext(nextCursor)}
          onPreviousPage={goPrevious}
          searchInputRef={searchInputRef}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          viewMode={viewMode}
          setViewMode={setViewMode}
          addToCart={addToCart}
          products={filteredProducts}
          isLoading={isLoading}
        />

        {/* Right Side - Cart */}
        <CartSale
          cartItems={cartItems}
          updateQuantity={updateQuantity}
          removeItem={removeItem}
          clearCart={clearCart}
          discount={discount}
          setDiscount={(value) => form.setValue("discount", value, {})}
          customer={form.getValues("customer")}
          total={total}
          setCustomerDialogOpen={setCustomerDialogOpen}
          setPaymentDialogOpen={handleOpenPayment}
          setItemQuantity={setItemQuantity}
          subtotal={subtotal}
          discountType={discountType}
          setDiscountType={(value) => form.setValue("discountType", value, {})}
          error={form.formState.errors}
        />
      </div>

      {/* Dialogs */}
      <SelectCustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        selectedCustomer={form.getValues("customer")}
        onSelect={(value) => form.setValue("customer", value, {})}
      />
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        total={total}
        customerName={customer?.name || null}
        onConfirm={handlePaymentConfirm}
        paymentMethod={form.watch("paymentMethod")}
        setPaymentMethod={(value) => form.setValue("paymentMethod", value, {})}
      />
      <SaleCompletedDialog
        open={completedDialogOpen}
        onOpenChange={setCompletedDialogOpen}
        sale={completedSale}
        receiptData={completedReceipt}
        onNewSale={() => {}}
        onPrintInvoice={() => {}}
      />
    </div>
  );
}
