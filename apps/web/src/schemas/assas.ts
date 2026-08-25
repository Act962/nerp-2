// All possible checkout events you can subscribe to
export type AsaasCheckoutEventType =
  | "CHECKOUT_CREATED"
  | "CHECKOUT_CANCELED"
  | "CHECKOUT_EXPIRED"
  | "CHECKOUT_PAID";

// Generic webhook payload structure
export interface AsaasCheckoutWebhook {
  id: string;
  event: AsaasCheckoutEventType;
  dateCreated: string; // e.g., "2024-10-31 18:07:47"
  account: {
    id: string;
    ownerId: string | null;
  };
  checkout: AsaasCheckoutPayload;
}

// Detailed checkout object
export interface AsaasCheckoutPayload {
  id: string;
  link: string | null;
  status: string; // ACTIVE, CANCELLED, PAID, etc.
  minutesToExpire: number;

  billingTypes: string[]; // ex: ["MUNDIPAGG_CIELO"]
  chargeTypes: string[]; // ex: ["RECURRENT"]

  callback: {
    cancelUrl: string | null;
    successUrl: string | null;
    expiredUrl: string | null;
  };

  items: AsaasCheckoutItem[];

  subscription: AsaasCheckoutSubscription | null;
  installment: AsaasCheckoutInstallment | null;

  split: AsaasCheckoutSplit[];

  customer: string | null;
  customerData: AsaasCustomerData | null;
}

// Each item in the checkout
export interface AsaasCheckoutItem {
  name: string;
  description: string;
  quantity: number;
  value: number;
}

// Subscription info when it’s a recurring checkout
export interface AsaasCheckoutSubscription {
  cycle: string; // e.g., "MONTHLY"
  nextDueDate: string; // ISO date or null
  endDate: string | null;
}

// Installment details (if applicable)
export interface AsaasCheckoutInstallment {
  // Add fields as needed depending on API specifics
}

// Split payment info
export interface AsaasCheckoutSplit {
  walletId: string;
  fixedValue: number | null;
  percentualValue: number | null;
  totalFixedValue: number | null;
}

// Optional extra data about customer (if provided)
export interface AsaasCustomerData {
  // Extend this type with fields you expect
  // Example: name, email, document etc.
  [key: string]: any;
}
