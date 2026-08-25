import {
  ArrowLeftRight,
  Banknote,
  BedDouble,
  CreditCard,
  Download,
  FileText,
  Home,
  Smartphone,
  Store,
  Wallet,
} from "lucide-react";

export const paymentMethodsConfig = {
  DINHEIRO: {
    label: "Dinheiro",
    icon: Banknote,
  },
  PIX: {
    label: "PIX",
    icon: Smartphone,
  },
  DEBITO: {
    label: "Cartão de Débito",
    icon: CreditCard,
  },
  CREDITO: {
    label: "Cartão de Crédito",
    icon: CreditCard,
  },
  BOLETO: {
    label: "Boleto",
    icon: FileText,
  },
  TRANSFERENCIA: {
    label: "Transferência Bancária",
    icon: ArrowLeftRight,
  },
  OUTROS: {
    label: "Outros",
    icon: Wallet,
  },
};

export const deliveryMethodsConfig = {
  DELIVERY_HOME: {
    label: "Entrega em Casa",
    description: "Receba no conforto da sua casa",
    icon: Home,
  },
  PICKUP_STORE: {
    label: "Retirada na Loja",
    description: "Retire pessoalmente na loja",
    icon: Store,
  },
  ROOM_SERVICE: {
    label: "Entrega no quarto",
    description: "Entrega no quarto",
    icon: BedDouble,
  },
  DIGITAL_DELIVERY: {
    label: "Entrega Digital",
    description: "Receba por e-mail ou download",
    icon: Download,
  },
};
