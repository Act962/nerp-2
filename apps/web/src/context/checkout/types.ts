import Stripe from "stripe";

export type ProductMetadata = {
  id: string;
  name: string;
  price: number;
  organizationId: string;
  organizationName: string;
};

export type CheckoutMetadata = {
  customerId: string;
};

export type ExpandedLineItem = Stripe.LineItem & {
  price: Stripe.Price & {
    product: Stripe.Product & {
      metadata: ProductMetadata;
    };
  };
};
