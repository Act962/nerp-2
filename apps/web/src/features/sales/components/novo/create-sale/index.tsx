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
import {
  recoverableItems,
  usePdvCartStore,
} from "@/features/sales/pdv-cart-store";
import { PendingOrdersDialog } from "../pending-orders-dialog";
import {
  CancelAuthDialog,
  type CancelAuthRequest,
} from "@/features/cancel-auth/components/cancel-auth-dialog";
import { SelectCustomerDialog } from "../select-customer-dialog";
import { PaymentDialog, type SalePaymentInput } from "../payment-dialog";
import { SaleCompletedDialog } from "../sale-completed-dialog";
import { usePdvProducts } from "@/features/products/hooks/use-products";
import { round2 } from "@/utils/pricing";
import { constructUrl } from "@/hooks/use-construct-url";
import type { PersonType } from "@/schemas/customer";
import { ProductSection } from "./product-section";
import { CartSale } from "./cart-sale";
import { type SaleFormData, saleSchema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationCreateSale } from "@/features/sales/hooks/use-sales";
import { useCaixaCurrent } from "@/features/caixa/hooks/use-caixa";
// CaixaInfoBar (nome/caixa/relógio) foi movida pro app-header — libera
// altura vertical na tela de venda. Ver PdvHeaderInfo/PdvHeaderClock.
import { toReceiptOrg } from "@/features/receipt-designer/lib/org-receipt";
import type { ReceiptSaleData } from "@/features/receipt-designer/lib/types";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import { useScannerStream } from "@/features/scanner/hooks/use-scanner";
import {
  ehLeituraRepetida,
  NENHUMA_LEITURA,
  type UltimaLeitura,
} from "@/features/scanner/lib/scan-dedupe";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
  // Se o produto controla estoque. Ausente em carrinho recuperado de sessão
  // anterior, por isso opcional — nesse caso o aviso de estoque não aparece.
  trackStock?: boolean;
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
  receiptOrg,
  requireCancelAuth = false,
}: {
  orgLogo?: string | null;
  orgName?: string | null;
  // Cabeçalho do cupom (razão social, CNPJ, endereço, telefone, logo) vindo do
  // banco — sem isso o cupom não fiscal sai sem identificação da loja.
  receiptOrg?: ReceiptSaleData["org"];
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
  const setHydratePayload = usePdvUiStore((state) => state.setHydratePayload);

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
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

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
  // Paginação por página (não cursor): o operador precisa saber quantos
  // produtos casaram com a busca e alcançar qualquer página.
  const [page, setPage] = useState(1);

  // Abas de categoria (filtro da grade).
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: categoriesData } = useQuery(
    orpc.categories.listWithoutSubcategory.queryOptions(),
  );
  const categories = categoriesData?.categories ?? [];
  const onSelectCategory = (id: string | null) => {
    setSelectedCategory(id);
    setPage(1);
  };

  // 200ms: rápido o bastante para não parecer travado ao digitar, longo o
  // bastante para uma palavra inteira virar uma consulta só.
  const debouncedSearch = useDebouncedValue(searchTerm, 200);

  const {
    data: products,
    totalCount: productsCount,
    totalPages,
    isLoading,
  } = usePdvProducts({
    page,
    // Alvo: 3 colunas × 3 linhas — tiles maiores, foto ocupa o vertical inteiro.
    pageSize: 9,
    categorySlug: selectedCategory ?? undefined,
    // Busca no SERVIDOR (não só na página carregada). DEBOUNCED: sem isso é
    // uma consulta por tecla digitada, e um código de 13 dígitos virava 13
    // consultas.
    search: debouncedSearch.trim() || undefined,
  });

  const mutation = useMutationCreateSale();

  // Última leitura ACEITA — base do descarte de bipe duplicado.
  const ultimaLeituraRef = useRef<UltimaLeitura>(NENHUMA_LEITURA);

  /**
   * Executa um bipe SEM NUNCA falhar em silêncio e SEM lançar duas vezes.
   *
   * As duas entradas de leitura faziam `void (async () => …)()` sem `catch`:
   * qualquer erro de rede, sessão ou servidor virava promise rejeitada que
   * ninguém tratava — nenhum toast, nenhum fallback. O operador bipava e não
   * acontecia nada, e a venda fechava sem o item. Código inexistente e falha de
   * consulta são coisas diferentes e cada uma tem o seu aviso.
   */
  const scanOuAvisar = async (
    code: string,
    aoNaoEncontrar: (code: string) => void,
  ): Promise<void> => {
    const agora = Date.now();
    if (ehLeituraRepetida(ultimaLeituraRef.current, code, agora)) {
      // Descartar em silêncio recriaria o problema oposto — o operador
      // achando que a segunda unidade entrou.
      toast.info("Leitura repetida ignorada. Bipe de novo para somar 1.", {
        id: "leitura-repetida",
      });
      return;
    }
    // Carimba ANTES do await: dois bipes com 100ms de diferença disparam duas
    // consultas em paralelo, e sem o carimbo aqui as duas passariam pela
    // janela e o item entraria em dobro do mesmo jeito.
    ultimaLeituraRef.current = { code, at: agora };

    const liberarRepeticao = () => {
      ultimaLeituraRef.current = NENHUMA_LEITURA;
    };

    try {
      if (await tryScan(code)) return;
      // Não achou: repetir na hora é legítimo (pode ter sido leitura torta).
      liberarRepeticao();
      aoNaoEncontrar(code);
    } catch (error) {
      liberarRepeticao();
      console.error(error);
      toast.error(`Falha ao consultar o código ${code}. Bipe de novo.`);
    }
  };

  // Bipe vai DIRETO para a busca exata por código. Antes ele só preenchia o
  // campo de busca, o que disparava uma consulta textual ao servidor por
  // caractere e só resolvia o produto no Enter — era a lentidão relatada.
  // Celular pareado: o código lido lá entra pelo MESMO caminho do leitor de
  // balcão, então promoção, estoque e pesável valem igual.
  const scannerToken = usePdvUiStore((state) => state.scannerToken);
  useScannerStream(scannerToken, (code) => {
    void scanOuAvisar(code, (naoAchado) =>
      toast.error(`Código não encontrado: ${naoAchado}`),
    );
  });

  useBarcodeScan(true, (barcode) => {
    // Não é código conhecido: cai na busca, que é o comportamento antigo.
    void scanOuAvisar(barcode, setSearchTerm);
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
      // Incrementa SEMPRE. Antes isto era travado em `quantity < currentStock`,
      // e com estoque desatualizado (o caso comum) bipar o mesmo item duas
      // vezes simplesmente não fazia nada — sem erro, sem aviso. Quem sinaliza
      // que passou do estoque é a linha do carrinho.
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
          unit: product.unit,
          price: Number(product.salePrice),
          quantity: 1,
          currentStock: Number(product.currentStock),
          trackStock: product.trackStock,
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

  const saveCart = usePdvCartStore((state) => state.save);
  const clearPersistedCart = usePdvCartStore((state) => state.clear);

  /**
   * O que havia para recuperar, lido na PRIMEIRA renderização.
   *
   * Precisa ser aqui, e não dentro do efeito de recuperação: o espelho abaixo
   * grava em efeito e, como estava declarado ANTES, o `saveCart([])` da
   * montagem apagava o sessionStorage segundos antes de alguém ler — a
   * recuperação nunca podia funcionar, e o toast nunca podia aparecer. Lendo no
   * render, a ordem dos efeitos deixa de importar.
   */
  const recuperadosRef = useRef<CartItem[] | null>(null);
  if (recuperadosRef.current === null) {
    recuperadosRef.current = recoverableItems(usePdvCartStore.getState());
  }

  // Espelho do carrinho fora da memória do React: se a tela morrer no meio da
  // venda (crash, deploy trocando os chunks, aba recarregada sem querer), o
  // operador não recomeça a passar os itens.
  useEffect(() => {
    saveCart(cartItems ?? []);
  }, [cartItems, saveCart]);

  // Recuperação: só quando o form está vazio (não atropela venda em curso) e
  // só uma vez por montagem.
  const cartRestoredRef = useRef(false);
  useEffect(() => {
    if (cartRestoredRef.current) return;
    cartRestoredRef.current = true;
    if (form.getValues("cartItems").length > 0) return;
    const recuperados = recuperadosRef.current ?? [];
    if (recuperados.length === 0) return;
    form.setValue("cartItems", recuperados, { shouldDirty: false });
    toast.info("Carrinho recuperado de antes do recarregamento");
  }, [form]);

  const clearCart = () => {
    form.reset();
    clearPersistedCart();
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
    if (term && /^\d+$/.test(term)) {
      try {
        if (await tryScan(term)) return;
      } catch (error) {
        // Falha de consulta não é "nada digitado": abrir o pagamento aqui
        // levaria o operador a fechar a venda sem o item que ele acabou de
        // tentar lançar.
        console.error(error);
        toast.error(`Falha ao consultar o código ${term}. Tente de novo.`);
        return;
      }
    }
    await handleOpenPayment();
  };

  // Arredondado a cada passo: sem isso um item pesável (0,001) ou um desconto
  // percentual produz total com 3+ casas — e aí o input de "Valor Recebido"
  // recusava 104,00 dizendo que os válidos mais próximos eram 103,995 e
  // 104,005, porque o `step` de 1 centavo se ancorava num número quebrado.
  const subtotal = round2(
    form
      .getValues("cartItems")
      .filter((item) => !item.cancelled)
      .reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  const discountAmount = round2(
    form.getValues("discountType") === "percent"
      ? (subtotal * form.getValues("discount")) / 100
      : form.getValues("discount"),
  );
  const total = Math.max(0, round2(subtotal - discountAmount));

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
        // Sem isto o servidor lia "10" como R$ 10,00 num desconto de 10%.
        discountType: form.getValues("discountType"),
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
            org: receiptOrg ?? toReceiptOrg({ name: orgName, logo: orgLogo }),
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
          setAutoPrintReceipt(data.printReceipt);
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
    // Fundo cinza full-bleed (cancela o padding do layout). Altura fixa na
    // viewport (menos o app-header): a página em si NÃO scrolla, o scroll é
    // interno da grade de produtos e do carrinho. Padrão de PDV — o operador
    // não perde o contexto do total/atalhos ao subir/descer a lista.
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-muted p-4 md:-m-6 md:p-6">
      {/* Carrinho ganha ~35% da largura (~620px) — cabem 4 colunas tabulares
          e ~8 itens sem scroll. A grade de produtos vira 3 colunas (foto
          preservada) pra sobrar espaço pro carrinho. */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_620px]">
        {/* Left Side - Product Selection */}
        <ProductSection
          page={page}
          totalPages={totalPages}
          totalCount={productsCount}
          onNextPage={() => setPage((atual) => Math.min(totalPages, atual + 1))}
          onPreviousPage={() => setPage((atual) => Math.max(1, atual - 1))}
          searchInputRef={searchInputRef}
          searchTerm={searchTerm}
          setSearchTerm={(value) => {
            setSearchTerm(value);
            setSelectedIndex(null);
            // Nova busca recomeça da 1ª página dos resultados.
            setPage(1);
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
          orgLogo={orgLogo}
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
        autoPrint={autoPrintReceipt}
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
