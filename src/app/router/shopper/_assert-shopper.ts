import { verifyShopperToken } from "@/features/shopper/lib/shopper-token";
import prisma from "@/lib/db";

type ShopperErrors = {
  UNAUTHORIZED: (options?: { message: string }) => Error;
};

// Valida o token bearer do shopper e confirma que ele ainda existe.
export async function assertShopper(
  token: string | undefined,
  errors: ShopperErrors,
): Promise<string> {
  const shopperId = verifyShopperToken(token);
  if (!shopperId) throw errors.UNAUTHORIZED({ message: "Faça login" });
  const shopper = await prisma.shopper.findUnique({
    where: { id: shopperId },
    select: { id: true },
  });
  if (!shopper) throw errors.UNAUTHORIZED({ message: "Sessão inválida" });
  return shopper.id;
}
