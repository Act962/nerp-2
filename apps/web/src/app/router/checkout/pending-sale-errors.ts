import { PendingSaleError } from "@/features/storefront/server/create-pending-sale";

type CheckoutErrorFactory = (options: { message: string }) => Error;

type CheckoutErrors = {
  NOT_FOUND: CheckoutErrorFactory;
  BAD_REQUEST: CheckoutErrorFactory;
};

/**
 * Traduz o erro de regra de `createPendingSale` para o `errors` tipado da
 * procedure. Erro que não é de regra segue adiante como veio.
 */
export function toCheckoutError(error: unknown, errors: CheckoutErrors) {
  if (!(error instanceof PendingSaleError)) return error;
  if (error.code === "CUSTOMER_REQUIRED") {
    return errors.BAD_REQUEST({ message: error.message });
  }
  return errors.NOT_FOUND({ message: error.message });
}
