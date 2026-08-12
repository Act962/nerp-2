"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useHotkeys,
  usePdvShortcuts,
} from "@/features/pdv-shortcuts/hooks/use-pdv-shortcuts";
import { ShortcutsDialog } from "@/features/pdv-shortcuts/components/shortcuts-dialog";
import {
  findProductByCode,
  usePdvWeighedConfig,
} from "@/features/pdv-weighed/hooks/use-weighed";
import { parseWeighedBarcode } from "@/features/pdv-weighed/weighed-barcode";
import { WeighedConfigDialog } from "@/features/pdv-weighed/components/weighed-config-dialog";
import { usePdvUiStore } from "@/features/sales/pdv-ui-store";
import { PendingOrdersDialog } from "../pending-orders-dialog";
import {
  CancelAuthDialog,
  type CancelAuthRequest,
} from "@/features/cancel-auth/components/cancel-auth-dialog";
import { SelectCustomerDialog } from "../select-customer-dialog";
import { PaymentDialog, type SalePaymentInput } from "../payment-dialog";
import { SaleCompletedDialog } from "../sale-completed-dialog";
import { useProducts } from "@/features/products/hooks/use-products";
import { constructUrl } from "@/hooks/use-construct-url";
import type { PersonType } from "@/schemas/customer";
import { ProductSection } from "./product-section";
import { CartSale } from "./cart-sale";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { type SaleFormData, saleSchema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationCreateSale } from "@/features/sales/hooks/use-sales";
import { useCaixaCurrent } from "@/features/caixa/hooks/use-caixa";
import { CaixaInfoBar } from "@/features/caixa/components/caixa-info-bar";
import type { ReceiptSaleData } from "@/features/receipt-designer/lib/types";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

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
  productId: string;
  name: string;
  currentStock: number;
  sku: string | null;
  // Unidade cadastrada do produto (UN, KG, L, M...) — mostrada no carrinho
  // pra o operador saber se deve inserir 0,1 (100g) ou 1 (1 un).
  unit: string;
  price: number;
  quantity: number;
  // Linha cancelada por autorização: permanece RISCADA no carrinho, fora do
  // total e do lançamento da venda.
  cancelled?: boolean;
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
  unit: string;
  isActive: boolean;
  // Se `false`, o PDV não bloqueia venda por estoque (produto sem controle
  // de inventário — ex.: serviços, itens contínuos).
  trackStock: boolean;
  maxStock?: number;
}

type ViewMode = "grid" | "list";

export default function CreateSalePage({
  orgLogo,
  orgName,
  requireCancelAuth = false,
}: {
  orgLogo?: string | null;
  orgName?: string | null;
  requireCancelAuth?: boolean;
}) {
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
  // Índice do produto destacado na grade (navegação por setas na busca).
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // A venda precisa de uma sessão de caixa aberta (o servidor também recusa).
  const { session: caixaSession } = useCaixaCurrent();

  const router = useRouter();
  const { bindings } = usePdvShortcuts();
  const { config: weighedConfig } = usePdvWeighedConfig();
  // Estado dos diálogos vive no store: os botões que os abrem estão na barra do
  // topo (app-header), fora desta árvore.
  const shortcutsOpen = usePdvUiStore((state) => state.shortcutsOpen);
  const setShortcutsOpen = usePdvUiStore((state) => state.setShortcutsOpen);
  const weighedOpen = usePdvUiStore((state) => state.weighedOpen);
  const setWeighedOpen = usePdvUiStore((state) => state.setWeighedOpen);
  // Payload de hidratação vindo da aprovação de pedido do catálogo online.
  // Quando setado, popula o carrinho e limpa (consumo único).
  const hydratePayload = usePdvUiStore((state) => state.hydratePayload);
  const setHydratePayload = usePdvUiStore(
    (state) => state.setHydratePayload,
  );

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
  // Venda ágil: item cuja quantidade recebe foco após adicionar por Enter. O
  // nonce força o re-foco mesmo ao adicionar o mesmo produto em sequência (o id
  // sozinho não mudaria e o efeito não re-rodaria).
  const focusNonce = useRef(0);
  const [focusItem, setFocusItem] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const { cursor, pageIndex, hasPrevious, goNext, goPrevious, reset } =
    useCursorPagination();

  // Abas de categoria (filtro da grade).
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: categoriesData } = useQuery(
    orpc.categories.listWithoutSubcategory.queryOptions(),
  );
  const categories = categoriesData?.categories ?? [];
  const onSelectCategory = (id: string | null) => {
    setSelectedCategory(id);
    reset();
  };

  const {
    hasNextPage,
    data: products,
    nextCursor,
    isLoading,
  } = useProducts({
    cursor,
    limit: 12,
    category: selectedCategory ? [selectedCategory] : undefined,
    // Busca no SERVIDOR (não só na página carregada): produtos fora das 12
    // primeiras também aparecem.
    search: searchTerm.trim() || undefined,
  });

  const mutation = useMutationCreateSale();

  useBarcodeScan(true, (barcode) => {
    setSearchTerm(barcode);
  });

  const filteredProducts = products
    ?.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.includes(searchTerm),
    )
    // A query devolve `image` como key crua do R2 (ex.: "abc-produto.jpg").
    // A lista de produtos passa pelo mesmo `constructUrl` (ver
    // products-container.tsx); sem isso o <img> no PDV busca do domínio
    // atual e a imagem não carrega, enquanto a mesma foto abre normal em
    // /produtos. Mesma correção aqui pra a grade e a lista mostrarem a foto.
    .map((p) => ({ ...p, image: p.image ? constructUrl(p.image) : "" }));

  const addToCart = (product: ProductSale) => {
    const currentCart = form.getValues("cartItems");
    const existingItem = currentCart.find(
      (item) => item.id === product.id && !item.cancelled,
    );

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
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          price: Number(product.salePrice),
          quantity: 1,
          currentStock: Number(product.currentStock),
        },
      ]);
    }
    // Venda ágil: qualquer forma de adicionar (Enter, clique no card, scan)
    // aponta o foco pra quantidade — o cart-sale foca no efeito.
    focusNonce.current += 1;
    setFocusItem({ id: product.id, nonce: focusNonce.current });
  };

  // Item pesável da balança: cada scan é uma medição própria, então gera uma
  // LINHA nova (não incrementa). PRICE = valor da etiqueta (qtd 1); WEIGHT =
  // peso × preço/kg do cadastro.
  const addWeighedLine = (
    product: {
      id: string;
      name: string;
      sku: string | null;
      salePrice: number;
      currentStock: number;
      unit?: string;
    },
    parsed: {
      kind: "PRICE" | "WEIGHT";
      price: number | null;
      weightKg: number | null;
    },
  ) => {
    const isPrice = parsed.kind === "PRICE";
    const quantity = isPrice ? 1 : (parsed.weightKg ?? 0);
    const price = isPrice ? (parsed.price ?? 0) : product.salePrice;
    if (quantity <= 0 || price <= 0) {
      toast.error("Valor inválido no código pesável");
      return;
    }
    form.setValue("cartItems", [
      ...form.getValues("cartItems"),
      {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit ?? (isPrice ? "UN" : "KG"),
        price,
        quantity,
        currentStock: product.currentStock,
      },
    ]);
  };

  // Venda ágil: adiciona e limpa a busca. O foco na quantidade é setado pelo
  // próprio addToCart (mesmo caminho pro Enter, clique no card e scan).
  const addProductAndReset = (product: ProductSale) => {
    addToCart(product);
    setSearchTerm("");
    setSelectedIndex(null);
  };

  // Enter/Esc na quantidade fecha o loop ágil: volta o foco pro campo de busca.
  const returnFocusToSearch = () => {
    setFocusItem(null);
    searchInputRef.current?.focus();
  };

  // Scan de código (leitor/balança): pesável ou match exato por barras/SKU.
  // Retorna true se adicionou algo ao carrinho.
  const tryScan = async (raw: string): Promise<boolean> => {
    const code = raw.trim();
    if (!code) return false;
    const weighed = parseWeighedBarcode(code, weighedConfig);
    if (weighed) {
      const { product } = await findProductByCode(weighed.itemCode);
      if (!product) {
        toast.error(`Produto pesável não encontrado: ${weighed.itemCode}`);
        return false;
      }
      addWeighedLine(product, weighed);
      setSearchTerm("");
      setSelectedIndex(null);
      searchInputRef.current?.focus();
      return true;
    }
    const { product } = await findProductByCode(code);
    if (!product) return false;
    const currentCart = form.getValues("cartItems");
    const existing = currentCart.find(
      (item) => item.id === product.id && !item.cancelled,
    );
    if (existing) {
      form.setValue(
        "cartItems",
        currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      form.setValue("cartItems", [
        ...currentCart,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit ?? "UN",
          price: product.salePrice,
          quantity: 1,
          currentStock: product.currentStock,
        },
      ]);
    }
    setSearchTerm("");
    setSelectedIndex(null);
    searchInputRef.current?.focus();
    return true;
  };

  // Navegação por setas na grade filtrada (do primeiro ao último).
  const moveSelection = (dir: "next" | "prev") => {
    const list = filteredProducts ?? [];
    if (list.length === 0) return;
    setSelectedIndex((prev) => {
      if (prev === null) return dir === "next" ? 0 : list.length - 1;
      const next = dir === "next" ? prev + 1 : prev - 1;
      return Math.max(0, Math.min(list.length - 1, next));
    });
  };
  const updateQuantity = (id: string, delta: number) => {
    const currentCart = form.getValues("cartItems");
    // Nunca zera a linha pelo botão "−" — clamp em 1. Remover é papel da
    // lixeira (guardedRemoveItem), que passa pelo antifraude se ligado.
    const updatedCart = currentCart.map((item) =>
      item.id === id
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item,
    );
    form.setValue("cartItems", updatedCart);
  };

  const setItemQuantity = (id: string, quantity: number) => {
    const currentCart = form.getValues("cartItems");
    // Aceita valor negativo/NaN → 0 (o "commit"/blur normaliza para o mínimo).
    // Zero é temporário — a linha SÓ é removida pela lixeira. Aceita decimais
    // p/ produtos por peso/volume (ex.: 0,1 kg = 100g).
    const nextQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
    const updatedCart = currentCart.map((item) =>
      item.id === id ? { ...item, quantity: nextQuantity } : item,
    );
    form.setValue("cartItems", updatedCart);
  };

  // Preço editável na linha do carrinho: afeta APENAS esta venda. O cadastro
  // do produto não é tocado. Clamp em 0 (não aceita negativo).
  const setItemPrice = (id: string, price: number) => {
    const currentCart = form.getValues("cartItems");
    const nextPrice = Math.max(0, Number.isFinite(price) ? price : 0);
    const updatedCart = currentCart.map((item) =>
      item.id === id ? { ...item, price: nextPrice } : item,
    );
    form.setValue("cartItems", updatedCart);
  };

  // Marca linhas do carrinho como "tocadas manualmente" — o operador editou o
  // preço à mão, então a re-resolução automática pela tabela do cliente NÃO
  // sobrescreve (senão volta a alterar o que ele acabou de digitar). Reset
  // implícito: remover a linha limpa a marca.
  const manualPriceOverrides = useRef<Set<string>>(new Set());
  const setItemPriceManual = (id: string, price: number) => {
    manualPriceOverrides.current.add(id);
    setItemPrice(id, price);
  };

  // Re-resolve preços do carrinho SEMPRE que muda: cliente selecionado, ids
  // de produtos ou quantidades. O server é a fonte da verdade (mesmo
  // resolver é chamado no `sales/create`) — aqui a UI só espelha o que
  // vai ser gravado, evitando o rejeito por total divergente.
  const cartKey = form
    .watch("cartItems")
    .map((i) => `${i.productId}:${i.quantity}`)
    .join("|");
  const customerIdForResolve = form.watch("customer")?.id ?? null;
  useEffect(() => {
    const items = form.getValues("cartItems");
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await orpc.precos.resolveMany.call({
          customerId: customerIdForResolve ?? undefined,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity || 1,
          })),
        });
        if (cancelled) return;
        // Aplica só onde o resolvido é diferente do que já tá na linha, e
        // pula linhas em que o operador editou o preço manualmente.
        res.lines.forEach((line: { unitPrice: number }, i: number) => {
          const target = items[i];
          if (!target) return;
          if (manualPriceOverrides.current.has(target.id)) return;
          if (Math.abs((target.price ?? 0) - line.unitPrice) > 0.001) {
            setItemPrice(target.id, line.unitPrice);
          }
        });
      } catch {
        // silencioso — o server rejeita o create se estiver muito fora.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, customerIdForResolve]);

  const removeItem = (id: string) => {
    const currentCart = form.getValues("cartItems");
    form.setValue(
      "cartItems",
      currentCart.filter((item) => item.id !== id),
    );
  };

  // Remoção autorizada: mantém a linha RISCADA no carrinho (rastro), em vez de
  // apagá-la. Fica fora dos totais e do lançamento da venda.
  const markCancelled = (id: string) => {
    const currentCart = form.getValues("cartItems");
    form.setValue(
      "cartItems",
      currentCart.map((item) =>
        item.id === id ? { ...item, cancelled: true } : item,
      ),
    );
  };

  const clearCart = () => {
    form.reset();
  };

  // Antifraude: quando a org exige autorização, remover item ou reduzir
  // quantidade passa por um supervisor (PIN na tela ou QR no celular). A ação
  // real só roda em `apply()` depois de aprovada.
  const [pendingCancel, setPendingCancel] = useState<
    (CancelAuthRequest & { apply: () => void }) | null
  >(null);

  const guardedRemoveItem = (id: string) => {
    if (!requireCancelAuth) return removeItem(id);
    const item = form.getValues("cartItems").find((i) => i.id === id);
    if (!item) return;
    setPendingCancel({
      kind: "REMOVE_ITEM",
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      amount: item.price * item.quantity,
      // Removeu tudo → linha riscada (rastro).
      apply: () => markCancelled(id),
    });
  };

  const guardedUpdateQuantity = (id: string, delta: number) => {
    // Aumentar quantidade nunca exige autorização.
    if (delta > 0 || !requireCancelAuth) return updateQuantity(id, delta);
    const item = form.getValues("cartItems").find((i) => i.id === id);
    if (!item) return;
    // "−" numa linha de 1 un. equivale a remover → risca; caso contrário reduz.
    const isRemoval = item.quantity <= 1;
    setPendingCancel({
      kind: isRemoval ? "REMOVE_ITEM" : "REDUCE_QTY",
      productName: item.name,
      quantity: 1,
      unitPrice: item.price,
      amount: item.price,
      apply: () => (isRemoval ? markCancelled(id) : updateQuantity(id, -1)),
    });
  };

  const handleOpenPayment = async () => {
    if (!caixaSession) {
      toast.error("Abra o caixa antes de vender.");
      return;
    }
    const hasActiveItem = form
      .getValues("cartItems")
      .some((item) => !item.cancelled);
    if (!hasActiveItem) {
      toast.error("Nenhum item ativo no carrinho.");
      return;
    }
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

  // Enter na busca:
  // - 1 produto filtrado → adiciona direto ao carrinho;
  // - vários + um selecionado por seta → adiciona o selecionado;
  // - código numérico não visível → scan (leitor/balança);
  // - nada digitado / nada selecionado → função do F2 (finalizar venda).
  const handleSearchEnter = async () => {
    const term = searchTerm.trim();
    const list = filteredProducts ?? [];

    if (term && list.length === 1) {
      addProductAndReset(list[0]);
      return;
    }
    if (term && selectedIndex !== null && list[selectedIndex]) {
      addProductAndReset(list[selectedIndex]);
      return;
    }
    if (term && /^\d+$/.test(term) && (await tryScan(term))) {
      return;
    }
    await handleOpenPayment();
  };

  const subtotal = form
    .getValues("cartItems")
    .filter((item) => !item.cancelled)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const discountAmount =
    form.getValues("discountType") === "percent"
      ? (subtotal * form.getValues("discount")) / 100
      : form.getValues("discount");
  const total = Math.max(0, subtotal - discountAmount);

  const handlePaymentConfirm = (data: {
    payments: SalePaymentInput[];
    paymentMethod: string;
    amountPaid: number;
    change: number;
    generateInvoice: boolean;
    printReceipt: boolean;
  }) => {
    const { cartItems, customer, discount } = form.getValues();

    const activeItems = cartItems.filter((item) => !item.cancelled);

    const items = activeItems.map((item) => ({
      productId: item.productId,
      productName: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
    }));

    const receiptItems = activeItems.map((item) => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.price * item.quantity,
    }));
    mutation.mutate(
      {
        items,
        customerId: customer?.id,
        discount,
        subtotal,
        total,
        status: SaleStatus.COMPLETED,
        payments: data.payments,
      },
      {
        onSuccess: (sale) => {
          setCompletedSale({
            saleNumber: sale.saleNumber,
            total,
            paymentMethod:
              data.payments.length > 1 ? "Misto" : data.paymentMethod,
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
            subtotal,
            discount: discountAmount,
            total,
            payments: data.payments.map((p) => ({
              method: String(p.method),
              amount: p.amount,
            })),
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

  // A busca de produto fica SEMPRE pronta para digitar (nome/SKU/código): foca
  // ao montar e sempre que os diálogos fecham.
  useEffect(() => {
    if (customerDialogOpen || paymentDialogOpen || shortcutsOpen || weighedOpen)
      return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [customerDialogOpen, paymentDialogOpen, shortcutsOpen, weighedOpen]);

  // Aprovação de pedido do Catálogo Online: o dialog "Aprovar" injeta
  // `hydratePayload` no store; aqui consumimos uma vez e populamos o carrinho
  // + cliente do form. O `id` da linha reusa o `productId` (sem itens
  // pesáveis nesse fluxo — quantidade veio do carrinho do cliente).
  useEffect(() => {
    if (!hydratePayload) return;
    form.setValue(
      "cartItems",
      hydratePayload.items.map((item) => ({
        id: item.productId,
        productId: item.productId,
        name: item.name,
        price: item.salePrice,
        quantity: item.quantity,
        currentStock: item.currentStock,
        sku: item.sku,
        unit: item.unit,
      })),
      { shouldValidate: false, shouldDirty: true },
    );
    if (hydratePayload.customer) {
      form.setValue("customer", hydratePayload.customer);
    }
    setHydratePayload(null);
  }, [hydratePayload, form, setHydratePayload]);

  useHotkeys(bindings, {
    "abrir-caixa": () => router.push("/vendas/caixa"),
    "finalizar-venda": () => {
      void handleOpenPayment();
    },
    "buscar-produto": () => searchInputRef.current?.focus(),
    "selecionar-cliente": () => setCustomerDialogOpen(true),
    "limpar-carrinho": () => clearCart(),
    "ajuda-atalhos": () => setShortcutsOpen(true),
  });

  return (
    // Fundo cinza full-bleed (cancela o padding do layout) para o painel branco
    // do carrinho — estilo cupom — se destacar.
    <div className="-m-4 min-h-[calc(100dvh-4rem)] bg-muted p-4 md:-m-6 md:p-6">
      <CaixaInfoBar />
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
          setSearchTerm={(value) => {
            setSearchTerm(value);
            setSelectedIndex(null);
            // Nova busca recomeça da 1ª página dos resultados.
            reset();
          }}
          selectedIndex={selectedIndex}
          onArrow={moveSelection}
          onEnter={handleSearchEnter}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          viewMode={viewMode}
          setViewMode={setViewMode}
          addToCart={addToCart}
          products={filteredProducts}
          isLoading={isLoading}
          searchShortcut={bindings["buscar-produto"]}
        />

        {/* Right Side - Cart */}
        <CartSale
          orgLogo={orgLogo}
          orgName={orgName}
          cartItems={cartItems}
          updateQuantity={guardedUpdateQuantity}
          removeItem={guardedRemoveItem}
          lockQuantityInput={requireCancelAuth}
          clearCart={clearCart}
          discount={discount}
          setDiscount={(value) => form.setValue("discount", value, {})}
          customer={form.getValues("customer")}
          total={total}
          setCustomerDialogOpen={setCustomerDialogOpen}
          setPaymentDialogOpen={handleOpenPayment}
          setItemQuantity={setItemQuantity}
          setItemPrice={setItemPriceManual}
          shortcuts={{
            selectCustomer: bindings["selecionar-cliente"],
            clearCart: bindings["limpar-carrinho"],
            finishSale: bindings["finalizar-venda"],
          }}
          focusItem={focusItem}
          onQuantityCommit={returnFocusToSearch}
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
        onSelectCustomer={() => setCustomerDialogOpen(true)}
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
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <WeighedConfigDialog open={weighedOpen} onOpenChange={setWeighedOpen} />
      <PendingOrdersDialog />
      <CancelAuthDialog
        open={pendingCancel !== null}
        onOpenChange={(next) => {
          if (!next) setPendingCancel(null);
        }}
        request={pendingCancel}
        cashSessionId={caixaSession?.id ?? null}
        onApproved={() => pendingCancel?.apply()}
      />
    </div>
  );
}
